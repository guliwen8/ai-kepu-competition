import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Button, Input, Picker, Textarea, Switch } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import styles from './index.module.scss';
import { me } from '../../services/auth';
import {
  createSubmissionDraft,
  getSubmission,
  submitSubmission,
  updateSubmissionDraft,
  uploadAttachment,
  type SubmissionCategory,
  type Submission,
} from '../../services/submissions';
import { getCurrentCompetition, type Competition } from '../../services/competitions';
import { useAuthStore } from '../../store/auth';

const defaultCategoryOptions: Array<{ label: string; value: SubmissionCategory }> = [
  { label: '科普剧', value: 'DRAMA' },
  { label: '科普视频', value: 'VIDEO' },
  { label: '科幻画', value: 'SCIFI_PAINT' },
  { label: '创意作品', value: 'CREATIVE_APP' },
];

type MaterialItem = {
  kind: string;
  name: string;
  rules: string;
  picker: 'video' | 'image' | 'file';
};

function normalizeSubmissionCategory(raw: any): SubmissionCategory | null {
  if (raw === 'DRAMA' || raw === 'VIDEO' || raw === 'SCIFI_PAINT' || raw === 'CREATIVE_APP')
    return raw;
  return null;
}

function categoryOptionsFromCompetitionConfig(
  config: any,
): Array<{ label: string; value: SubmissionCategory }> | null {
  if (Array.isArray(config?.categoryOptions)) {
    const out: Array<{ label: string; value: SubmissionCategory }> = [];
    for (const it of config.categoryOptions) {
      if (!it || typeof it !== 'object') continue;
      const value = normalizeSubmissionCategory((it as any).value);
      const label = typeof (it as any).label === 'string' ? (it as any).label : null;
      if (!value || !label) continue;
      out.push({ label, value });
    }
    if (out.length) return out;
  }

  if (Array.isArray(config?.allowedCategories)) {
    const allowed = config.allowedCategories
      .map((v: any) => normalizeSubmissionCategory(v))
      .filter(Boolean) as SubmissionCategory[];
    const set = new Set(allowed);
    const out = defaultCategoryOptions.filter((o) => set.has(o.value));
    if (out.length) return out;
  }

  return null;
}

type FieldKey = 'title' | 'intro' | 'aiToolsUsage' | 'teacherName' | 'teacherContact';
type FieldCfg = {
  enabled: boolean;
  required: boolean;
  label: string;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
};

function fieldCfgFromCompetitionConfig(config: any, key: FieldKey): FieldCfg {
  const defaults: Record<FieldKey, FieldCfg> = {
    title: {
      enabled: true,
      required: true,
      label: '作品标题',
      placeholder: '请输入作品标题（必填）',
      maxLength: 80,
    },
    intro: {
      enabled: true,
      required: false,
      label: '作品简介',
      placeholder: '可选，300 字以内',
      maxLength: 300,
    },
    aiToolsUsage: {
      enabled: true,
      required: false,
      label: 'AI 工具使用说明',
      placeholder: '如使用了 AI，请说明工具与使用方式（建议填写）',
      maxLength: 500,
    },
    teacherName: {
      enabled: true,
      required: true,
      label: '指导老师姓名',
      placeholder: '请输入指导老师姓名（必填）',
      maxLength: 50,
    },
    teacherContact: {
      enabled: true,
      required: true,
      label: '指导老师联系方式',
      placeholder: '手机号/邮箱等（必填）',
      maxLength: 50,
      hint: '注意：提交后系统会进行匿名检测，作品中请勿出现作者/单位等信息',
    },
  };

  const raw = config?.registrationFields?.[key];
  if (raw === false)
    return {
      ...defaults[key],
      enabled: key === 'title' ? true : false,
      required: key === 'title' ? true : false,
    };
  if (raw && typeof raw === 'object') {
    const d = defaults[key];
    const enabled = typeof (raw as any).enabled === 'boolean' ? (raw as any).enabled : d.enabled;
    const required =
      typeof (raw as any).required === 'boolean' ? (raw as any).required : d.required;
    const label = typeof (raw as any).label === 'string' ? (raw as any).label : d.label;
    const placeholder =
      typeof (raw as any).placeholder === 'string' ? (raw as any).placeholder : d.placeholder;
    const hint = typeof (raw as any).hint === 'string' ? (raw as any).hint : d.hint;
    const maxLength =
      typeof (raw as any).maxLength === 'number' ? (raw as any).maxLength : d.maxLength;
    return {
      enabled: key === 'title' ? true : enabled,
      required: key === 'title' ? true : required,
      label,
      placeholder,
      hint,
      maxLength,
    };
  }

  return defaults[key];
}

function labelCompetitionPhase(phase: string) {
  if (phase === 'DRAFT') return '未开始';
  if (phase === 'SUBMISSION') return '报名投稿';
  if (phase === 'JUDGING') return '评审中';
  if (phase === 'PUBLIC') return '公示中';
  if (phase === 'ENDED') return '已结束';
  return phase;
}

function requirementsFor(category: SubmissionCategory): MaterialItem[] {
  if (category === 'DRAMA') {
    return [
      { kind: 'VIDEO', name: '作品视频', rules: 'MP4，≤500MB', picker: 'video' },
      { kind: 'SCRIPT', name: '剧本文件', rules: 'Word（.doc/.docx），≤50MB', picker: 'file' },
    ];
  }
  if (category === 'VIDEO') {
    return [{ kind: 'VIDEO', name: '作品视频', rules: 'MP4，1–5 分钟，≤500MB', picker: 'video' }];
  }
  if (category === 'SCIFI_PAINT') {
    return [
      { kind: 'IMAGE', name: '作品图片', rules: 'JPG/PNG，4–30MB', picker: 'image' },
      { kind: 'STATEMENT', name: '作品说明', rules: 'Word/PDF，≤50MB', picker: 'file' },
    ];
  }
  return [
    { kind: 'VIDEO', name: '作品视频', rules: 'MP4，≤500MB', picker: 'video' },
    { kind: 'DOC', name: '说明文档/源码包', rules: 'PDF/Word/ZIP，≤200MB', picker: 'file' },
  ];
}

function pickerForKind(kind: string): MaterialItem['picker'] {
  if (kind === 'VIDEO') return 'video';
  if (kind === 'IMAGE') return 'image';
  return 'file';
}

function nameForKind(kind: string): string {
  const map: Record<string, string> = {
    VIDEO: '作品视频',
    SCRIPT: '剧本文件',
    IMAGE: '作品图片',
    STATEMENT: '作品说明',
    DOC: '说明文档/源码包',
  };
  return map[kind] ?? kind;
}

function formatBytesToMb(bytes: number) {
  const mb = bytes / (1024 * 1024);
  const rounded = mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10;
  return `${rounded}MB`;
}

function normalizeMimeLabel(m: string) {
  const lower = String(m).toLowerCase();
  if (lower === 'video/mp4') return 'MP4';
  if (lower === 'image/jpeg') return 'JPG';
  if (lower === 'image/png') return 'PNG';
  if (lower === 'application/pdf') return 'PDF';
  if (lower === 'application/msword') return 'Word（.doc）';
  if (lower === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    return 'Word（.docx）';
  if (lower === 'application/zip' || lower === 'application/x-zip-compressed') return 'ZIP';
  const seg = lower.split('/')[1];
  return seg ? seg.toUpperCase() : m;
}

function rulesTextFromConfigRules(rulesRaw: any[]) {
  const acc: {
    minBytes?: number;
    maxBytes?: number;
    mimeTypes?: Set<string>;
    durationSecMin?: number;
    durationSecMax?: number;
  } = {};

  for (const r of rulesRaw) {
    if (!r || typeof r !== 'object') continue;
    if (typeof r.durationSecMin === 'number' && typeof r.durationSecMax === 'number') {
      acc.durationSecMin = r.durationSecMin;
      acc.durationSecMax = r.durationSecMax;
    }
    if (typeof r.minBytes === 'number') acc.minBytes = r.minBytes;
    if (typeof r.maxBytes === 'number') acc.maxBytes = r.maxBytes;
    if (Array.isArray(r.mimeTypes)) {
      if (!acc.mimeTypes) acc.mimeTypes = new Set();
      for (const m of r.mimeTypes) {
        if (typeof m === 'string') acc.mimeTypes.add(normalizeMimeLabel(m));
      }
    }
  }

  const parts: string[] = [];
  if (acc.mimeTypes && acc.mimeTypes.size) parts.push(Array.from(acc.mimeTypes).join('/'));
  if (typeof acc.minBytes === 'number' && typeof acc.maxBytes === 'number') {
    parts.push(`${formatBytesToMb(acc.minBytes)}–${formatBytesToMb(acc.maxBytes)}`);
  } else if (typeof acc.maxBytes === 'number') {
    parts.push(`≤${formatBytesToMb(acc.maxBytes)}`);
  } else if (typeof acc.minBytes === 'number') {
    parts.push(`≥${formatBytesToMb(acc.minBytes)}`);
  }

  if (typeof acc.durationSecMin === 'number' && typeof acc.durationSecMax === 'number') {
    if (acc.durationSecMin % 60 === 0 && acc.durationSecMax % 60 === 0) {
      parts.push(`${acc.durationSecMin / 60}–${acc.durationSecMax / 60} 分钟`);
    } else {
      parts.push(`${acc.durationSecMin}–${acc.durationSecMax} 秒`);
    }
  }

  return parts.length ? parts.join('，') : '按赛事要求';
}

function requirementsFromCompetitionConfig(
  config: any,
  category: SubmissionCategory,
): MaterialItem[] | null {
  const raw = config?.materialRequirements?.[category];
  if (!raw || typeof raw !== 'object') return null;
  const requiredKinds = Array.isArray((raw as any).requiredKinds)
    ? (raw as any).requiredKinds.filter((k: any) => typeof k === 'string')
    : null;
  const rulesRaw = Array.isArray((raw as any).rules) ? (raw as any).rules : null;
  if (!requiredKinds || !rulesRaw) return null;

  return requiredKinds.map((kind: string) => {
    const rulesForKind = rulesRaw.filter((r: any) => r && typeof r === 'object' && r.kind === kind);
    return {
      kind,
      name: nameForKind(kind),
      rules: rulesTextFromConfigRules(rulesForKind),
      picker: pickerForKind(kind),
    };
  });
}

function latestAttachment(sub: Submission | null, kind: string) {
  const list = sub?.attachments?.filter((a) => a.kind === kind) ?? [];
  if (list.length === 0) return null;
  return list
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

const SubmitPage: React.FC = () => {
  const tokens = useAuthStore((s) => s.tokens);
  const profile = useAuthStore((s) => s.me);
  const setMe = useAuthStore((s) => s.setMe);
  const [loading, setLoading] = useState(false);
  const [currentCompetition, setCurrentCompetition] = useState<Competition | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [flowLoading, setFlowLoading] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [category, setCategory] = useState<SubmissionCategory>('VIDEO');
  const [title, setTitle] = useState('');
  const [intro, setIntro] = useState('');
  const [aiToolsUsage, setAiToolsUsage] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [teacherContact, setTeacherContact] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const loggedIn = useMemo(() => Boolean(tokens?.accessToken), [tokens?.accessToken]);
  const categoryOptions = useMemo(() => {
    const fromConfig = categoryOptionsFromCompetitionConfig(currentCompetition?.config);
    return fromConfig ?? defaultCategoryOptions;
  }, [currentCompetition?.config]);
  const categoryIndex = useMemo(() => {
    const idx = categoryOptions.findIndex((o) => o.value === category);
    return idx >= 0 ? idx : 0;
  }, [category, categoryOptions]);
  const categoryLabel = useMemo(() => {
    return categoryOptions.find((o) => o.value === category)?.label ?? '科普视频';
  }, [category, categoryOptions]);
  const materialList = useMemo(() => {
    const fromConfig = requirementsFromCompetitionConfig(currentCompetition?.config, category);
    return fromConfig ?? requirementsFor(category);
  }, [category, currentCompetition?.config]);
  const canSubmit = useMemo(
    () => !currentCompetition || currentCompetition.phase === 'SUBMISSION',
    [currentCompetition],
  );
  const titleCfg = useMemo(
    () => fieldCfgFromCompetitionConfig(currentCompetition?.config, 'title'),
    [currentCompetition?.config],
  );
  const introCfg = useMemo(
    () => fieldCfgFromCompetitionConfig(currentCompetition?.config, 'intro'),
    [currentCompetition?.config],
  );
  const aiCfg = useMemo(
    () => fieldCfgFromCompetitionConfig(currentCompetition?.config, 'aiToolsUsage'),
    [currentCompetition?.config],
  );
  const teacherNameCfg = useMemo(
    () => fieldCfgFromCompetitionConfig(currentCompetition?.config, 'teacherName'),
    [currentCompetition?.config],
  );
  const teacherContactCfg = useMemo(
    () => fieldCfgFromCompetitionConfig(currentCompetition?.config, 'teacherContact'),
    [currentCompetition?.config],
  );
  const privacyCfg = useMemo(() => {
    const raw = currentCompetition?.config?.privacyConfirmation;
    if (!raw || typeof raw !== 'object') return { enabled: false, text: '' };
    const enabled = typeof (raw as any).enabled === 'boolean' ? (raw as any).enabled : false;
    const text = typeof (raw as any).text === 'string' ? (raw as any).text : '';
    return { enabled, text };
  }, [currentCompetition?.config]);

  async function loadMe() {
    if (!loggedIn) return;
    setLoading(true);
    try {
      const data = await me();
      setMe(data);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadCompetition() {
    try {
      const c = await getCurrentCompetition();
      setCurrentCompetition(c);
    } catch {
      setCurrentCompetition(null);
    }
  }

  useDidShow(() => {
    void loadMe();
    void loadCompetition();
  });

  useEffect(() => {
    if (loggedIn && !profile) {
      void loadMe();
    }
  }, [loggedIn, profile]);

  useEffect(() => {
    void loadCompetition();
  }, [loggedIn]);

  useEffect(() => {
    setPrivacyAccepted(false);
  }, [currentCompetition?.id]);

  useEffect(() => {
    if (submissionId) return;
    if (categoryOptions.some((o) => o.value === category)) return;
    const first = categoryOptions[0]?.value;
    if (first) setCategory(first);
  }, [category, categoryOptions, submissionId]);

  function goLogin() {
    Taro.navigateTo({ url: '/pages/login/index' });
  }

  function validateDraftFields() {
    if (titleCfg.required && !title.trim()) return '请填写作品标题';
    if (teacherNameCfg.enabled && teacherNameCfg.required && !teacherName.trim())
      return '请填写指导老师姓名';
    if (teacherContactCfg.enabled && teacherContactCfg.required && !teacherContact.trim())
      return '请填写指导老师联系方式';
    return null;
  }

  async function saveDraft() {
    setFlowError(null);
    setFlowLoading(true);
    try {
      const msg = validateDraftFields();
      if (msg) throw new Error(msg);

      if (!submissionId) {
        const sub = await createSubmissionDraft({
          category,
          title: title.trim(),
          intro: introCfg.enabled ? intro.trim() || undefined : undefined,
          aiToolsUsage: aiCfg.enabled ? aiToolsUsage.trim() || undefined : undefined,
          teacherName: teacherNameCfg.enabled ? teacherName.trim() || undefined : undefined,
          teacherContact: teacherContactCfg.enabled
            ? teacherContact.trim() || undefined
            : undefined,
        });
        setSubmissionId(sub.id);
        setSubmission(sub);
        Taro.showToast({ title: '草稿已创建', icon: 'success' });
        return sub.id;
      }

      const sub = await updateSubmissionDraft(submissionId, {
        title: title.trim(),
        intro: introCfg.enabled ? intro.trim() || undefined : undefined,
        aiToolsUsage: aiCfg.enabled ? aiToolsUsage.trim() || undefined : undefined,
        teacherName: teacherNameCfg.enabled ? teacherName.trim() || undefined : undefined,
        teacherContact: teacherContactCfg.enabled ? teacherContact.trim() || undefined : undefined,
      });
      setSubmission(sub);
      Taro.showToast({ title: '草稿已保存', icon: 'success' });
      return submissionId;
    } catch (e) {
      setFlowError(e instanceof Error ? e.message : '保存失败');
      return null;
    } finally {
      setFlowLoading(false);
    }
  }

  async function chooseAndUpload(kind: string, picker: MaterialItem['picker']) {
    const id = submissionId ?? (await saveDraft());
    if (!id) return;
    setFlowError(null);
    setFlowLoading(true);
    try {
      let filePath = '';
      let durationSec = 0;

      if (picker === 'video') {
        const res = await Taro.chooseMedia({
          count: 1,
          mediaType: ['video'],
          sourceType: ['album', 'camera'],
        });
        const f = res.tempFiles?.[0];
        if (!f) throw new Error('未选择文件');
        filePath = f.tempFilePath;
        durationSec = Math.round((f as any).duration ?? 0);
      } else if (picker === 'image') {
        const res = await Taro.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
        });
        const f = res.tempFiles?.[0];
        if (!f) throw new Error('未选择文件');
        filePath = f.tempFilePath;
      } else {
        const res = await Taro.chooseMessageFile({
          count: 1,
          type: 'file',
        });
        const f = (res as any).tempFiles?.[0];
        if (!f) throw new Error('未选择文件');
        filePath = f.path;
      }

      await uploadAttachment({
        submissionId: id,
        kind,
        filePath,
        formData: durationSec ? { durationSec: String(durationSec) } : {},
      });
      Taro.showToast({ title: '上传成功', icon: 'success' });
      const sub = await getSubmission(id);
      setSubmission(sub);
    } catch (e) {
      setFlowError(e instanceof Error ? e.message : '上传失败');
    } finally {
      setFlowLoading(false);
    }
  }

  async function submitNow() {
    if (!canSubmit) {
      setFlowError(
        `当前赛事阶段为「${labelCompetitionPhase(currentCompetition?.phase ?? '')}」，暂不可提交，请在报名投稿阶段再提交。`,
      );
      return;
    }
    if (privacyCfg.enabled && !privacyAccepted) {
      setFlowError('请先确认隐私与匿名要求');
      return;
    }
    const id = submissionId ?? (await saveDraft());
    if (!id) return;
    setFlowError(null);
    setFlowLoading(true);
    try {
      const review = await submitSubmission(id);
      Taro.showModal({
        title: '提交结果',
        content: typeof review === 'string' ? review : JSON.stringify(review),
        showCancel: false,
      });
    } catch (e) {
      setFlowError(e instanceof Error ? e.message : '提交失败');
    } finally {
      setFlowLoading(false);
    }
  }

  return (
    <View className={styles.container}>
      <View className={styles.headerCard}>
        <Text className={styles.headerTitle}>在线报名</Text>
        <Text className={styles.headerSub}>
          填写报名信息、上传作品与材料，系统将自动进行格式合规、匿名检测与内容初审。
        </Text>
        {currentCompetition ? (
          <Text className={styles.headerSub}>
            当前赛事：{currentCompetition.title}（{labelCompetitionPhase(currentCompetition.phase)}
            ）
          </Text>
        ) : null}
      </View>

      {!loggedIn ? (
        <View className={styles.card}>
          <Text className={styles.cardTitle}>请先登录</Text>
          <Text className={styles.cardDesc}>登录后可创建报名并查看审核进度。</Text>
          <Button className={styles.primaryBtn} onClick={goLogin}>
            去登录
          </Button>
        </View>
      ) : (
        <View className={styles.card}>
          <Text className={styles.cardTitle}>当前账号</Text>
          <Text className={styles.cardDesc}>
            {loading ? '加载中...' : profile?.phone ? `手机号：${profile.phone}` : '已登录'}
          </Text>
          {submissionId ? (
            <Text className={styles.cardDesc}>当前草稿：{submissionId}</Text>
          ) : (
            <Text className={styles.cardDesc}>未创建草稿</Text>
          )}

          <View className={styles.form}>
            <View className={styles.field}>
              <Text className={styles.label}>作品类别</Text>
              {!submissionId ? (
                <Picker
                  mode="selector"
                  range={categoryOptions.map((x) => x.label)}
                  value={categoryIndex}
                  onChange={(e) => {
                    const idx = Number(e.detail.value);
                    const next = categoryOptions[idx]?.value;
                    if (next) setCategory(next);
                  }}
                >
                  <View className={styles.input}>{categoryLabel}</View>
                </Picker>
              ) : (
                <View className={styles.input}>{categoryLabel}</View>
              )}
              <Text className={styles.hint}>
                {!submissionId
                  ? '请选择参赛作品类别，不同类别要求的材料不同'
                  : '作品类别创建后不可修改'}
              </Text>
            </View>

            <View className={styles.field}>
              <Text className={styles.label}>{titleCfg.label}</Text>
              <Input
                className={styles.input}
                value={title}
                placeholder={titleCfg.placeholder}
                maxlength={titleCfg.maxLength}
                onInput={(e) => setTitle(e.detail.value)}
              />
            </View>

            {introCfg.enabled ? (
              <View className={styles.field}>
                <Text className={styles.label}>{introCfg.label}</Text>
                <Textarea
                  className={styles.textarea}
                  value={intro}
                  placeholder={introCfg.placeholder}
                  maxlength={introCfg.maxLength}
                  onInput={(e) => setIntro(e.detail.value)}
                />
              </View>
            ) : null}

            {aiCfg.enabled ? (
              <View className={styles.field}>
                <Text className={styles.label}>{aiCfg.label}</Text>
                <Textarea
                  className={styles.textarea}
                  value={aiToolsUsage}
                  placeholder={aiCfg.placeholder}
                  maxlength={aiCfg.maxLength}
                  onInput={(e) => setAiToolsUsage(e.detail.value)}
                />
              </View>
            ) : null}

            {teacherNameCfg.enabled ? (
              <View className={styles.field}>
                <Text className={styles.label}>{teacherNameCfg.label}</Text>
                <Input
                  className={styles.input}
                  value={teacherName}
                  placeholder={teacherNameCfg.placeholder}
                  maxlength={teacherNameCfg.maxLength}
                  onInput={(e) => setTeacherName(e.detail.value)}
                />
              </View>
            ) : null}

            {teacherContactCfg.enabled ? (
              <View className={styles.field}>
                <Text className={styles.label}>{teacherContactCfg.label}</Text>
                <Input
                  className={styles.input}
                  value={teacherContact}
                  placeholder={teacherContactCfg.placeholder}
                  maxlength={teacherContactCfg.maxLength}
                  onInput={(e) => setTeacherContact(e.detail.value)}
                />
                {teacherContactCfg.hint ? (
                  <Text className={styles.hint}>{teacherContactCfg.hint}</Text>
                ) : null}
              </View>
            ) : null}
          </View>

          {flowError ? <Text className={styles.errorText}>{flowError}</Text> : null}

          <Button className={styles.primaryBtn} disabled={flowLoading} onClick={saveDraft}>
            {submissionId ? '保存草稿' : '创建草稿'}
          </Button>
          <View className={styles.materials}>
            <Text className={styles.materialsTitle}>材料清单</Text>
            {materialList.map((m) => {
              const att = latestAttachment(submission, m.kind);
              return (
                <View key={m.kind} className={styles.materialRow}>
                  <View className={styles.materialInfo}>
                    <Text className={styles.materialName}>{m.name}</Text>
                    <Text className={styles.materialMeta}>{m.rules}</Text>
                    <Text className={styles.materialMeta}>
                      {att ? `已上传：${att.originalName}` : '未上传'}
                    </Text>
                  </View>
                  <Button
                    className={styles.miniBtn}
                    disabled={flowLoading}
                    onClick={() => chooseAndUpload(m.kind, m.picker)}
                  >
                    {att ? '重新上传' : '上传'}
                  </Button>
                </View>
              );
            })}
          </View>

          {privacyCfg.enabled ? (
            <View className={styles.field}>
              <View className={styles.materialRow}>
                <View className={styles.materialInfo}>
                  <Text className={styles.label}>隐私确认</Text>
                </View>
                <Switch
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(Boolean((e as any).detail?.value))}
                />
              </View>
              <Text className={styles.hint}>
                {privacyCfg.text ||
                  '我已阅读并同意隐私与匿名要求，提交材料中不包含作者/单位等身份信息。'}
              </Text>
            </View>
          ) : null}

          {!canSubmit ? (
            <Text className={styles.hint}>
              当前不在报名投稿阶段，可先完善草稿与材料，报名开启后再提交。
            </Text>
          ) : null}
          <Button
            className={styles.secondaryBtn}
            disabled={
              flowLoading || !submissionId || !canSubmit || (privacyCfg.enabled && !privacyAccepted)
            }
            onClick={submitNow}
          >
            提交并生成审核
          </Button>
        </View>
      )}
    </View>
  );
};

export default SubmitPage;
