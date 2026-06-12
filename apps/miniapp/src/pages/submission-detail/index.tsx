import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import styles from './index.module.scss';
import { useAuthStore } from '../../store/auth';
import {
  getSubmission,
  type Submission,
  type SubmissionCategory,
  type ReviewFinding,
  type ReviewTask,
} from '../../services/submissions';

function labelCategory(v: SubmissionCategory) {
  if (v === 'VIDEO') return '科普视频';
  if (v === 'DRAMA') return '科普剧';
  if (v === 'SCIFI_PAINT') return '科幻画';
  if (v === 'CREATIVE_APP') return '创意作品';
  return v;
}

function labelStatus(v: string) {
  if (v === 'DRAFT') return '草稿';
  if (v === 'NEED_FIX') return '需修改';
  if (v === 'UNDER_REVIEW') return '审核中';
  if (v === 'APPROVED') return '已通过';
  if (v === 'REJECTED') return '已拒绝';
  return v;
}

function labelSummary(v: string) {
  if (v === 'PASS') return '通过';
  if (v === 'FAIL') return '不通过';
  if (v === 'NEED_MANUAL') return '待人工复核';
  if (v === 'PENDING') return '待执行';
  return v;
}

function labelTaskType(v: string) {
  if (v === 'FORMAT') return '格式';
  if (v === 'ANONYMITY') return '匿名';
  if (v === 'CONTENT') return '内容';
  return v;
}

function tagClass(status: string) {
  if (status === 'PASS') return `${styles.tag} ${styles.tagOk}`;
  if (status === 'FAIL') return `${styles.tag} ${styles.tagBad}`;
  if (status === 'NEED_MANUAL') return `${styles.tag} ${styles.tagWarn}`;
  return styles.tag;
}

function normalizeFinding(item: any): ReviewFinding {
  if (item && typeof item === 'object') return item as ReviewFinding;
  if (typeof item === 'string') return { message: item };
  return { message: '未知问题' };
}

function findingText(item: ReviewFinding) {
  const field = typeof item.field === 'string' ? item.field.trim() : '';
  const msg = typeof item.message === 'string' ? item.message.trim() : '';
  const code = typeof item.code === 'string' ? item.code.trim() : '';
  if (field && msg) return `${field}：${msg}`;
  if (msg) return msg;
  if (code) return code;
  return '未知问题';
}

function normalizeFindings(findings: any): string[] {
  if (!findings) return [];
  if (Array.isArray(findings))
    return findings.map((it) => findingText(normalizeFinding(it))).filter(Boolean);
  return [findingText(normalizeFinding(findings))].filter(Boolean);
}

function sortTasks(tasks: ReviewTask[]) {
  const order: Record<string, number> = { FORMAT: 1, ANONYMITY: 2, CONTENT: 3 };
  return tasks.slice().sort((a, b) => (order[a.type] ?? 99) - (order[b.type] ?? 99));
}

export default function SubmissionDetailPage() {
  const tokens = useAuthStore((s) => s.tokens);
  const loggedIn = useMemo(() => Boolean(tokens?.accessToken), [tokens?.accessToken]);

  const id = useMemo(() => {
    const params = Taro.getCurrentInstance().router?.params ?? {};
    const v = (params as any).id;
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<Submission | null>(null);

  async function load() {
    if (!loggedIn) return;
    if (!id) {
      setError('缺少作品 id');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getSubmission(id);
      setItem(data);
      if (data?.title) {
        Taro.setNavigationBarTitle({ title: '作品详情' });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useDidShow(() => {
    void load();
  });

  useEffect(() => {
    if (loggedIn) void load();
  }, [loggedIn]);

  function goLogin() {
    Taro.navigateTo({ url: '/pages/login/index' });
  }

  function backToList() {
    const pages = Taro.getCurrentPages();
    if (pages.length > 1) {
      Taro.navigateBack();
      return;
    }
    Taro.navigateTo({ url: '/pages/submissions/index' });
  }

  function goSubmit() {
    Taro.switchTab({ url: '/pages/submit/index' });
  }

  const latestReview = item?.reviewCases?.[0] ?? null;
  const tasks = latestReview?.tasks ? sortTasks(latestReview.tasks) : [];

  return (
    <View className={styles.container}>
      <View className={styles.header}>
        <View>
          <Text className={styles.title}>{item?.title || '作品详情'}</Text>
          <Text className={styles.sub}>查看审核结论与修改建议</Text>
        </View>
      </View>

      {!loggedIn ? (
        <View className={styles.card}>
          <Text className={styles.error}>请先登录</Text>
          <View className={styles.actions}>
            <Button className={styles.primaryBtn} onClick={goLogin}>
              去登录
            </Button>
            <Button className={styles.secondaryBtn} onClick={backToList}>
              返回
            </Button>
          </View>
        </View>
      ) : (
        <>
          <View className={styles.card}>
            <Text className={styles.sectionTitle}>基本信息</Text>
            {error ? <Text className={styles.error}>{error}</Text> : null}
            {loading ? <Text className={styles.muted}>加载中...</Text> : null}

            {item ? (
              <>
                <View className={styles.tagRow}>
                  <Text className={styles.tag}>{labelCategory(item.category)}</Text>
                  <Text className={styles.tag}>{labelStatus(item.status)}</Text>
                  {latestReview ? (
                    <Text className={tagClass(latestReview.summary)}>
                      {labelSummary(latestReview.summary)}
                    </Text>
                  ) : null}
                </View>

                <View className={styles.row}>
                  <Text className={styles.label}>作品简介</Text>
                  <Text className={styles.value}>{item.intro || '-'}</Text>
                </View>
                <View className={styles.row}>
                  <Text className={styles.label}>AI 工具使用</Text>
                  <Text className={styles.value}>{item.aiToolsUsage || '-'}</Text>
                </View>
                <View className={styles.row}>
                  <Text className={styles.label}>指导老师</Text>
                  <Text className={styles.value}>{item.teacherName || '-'}</Text>
                </View>
                <View className={styles.row}>
                  <Text className={styles.label}>老师联系方式</Text>
                  <Text className={styles.value}>{item.teacherContact || '-'}</Text>
                </View>
              </>
            ) : null}
          </View>

          <View className={styles.card}>
            <Text className={styles.sectionTitle}>材料清单</Text>
            {!item ? <Text className={styles.muted}>暂无数据</Text> : null}
            {item?.attachments?.length ? (
              item.attachments.map((a) => (
                <View key={a.id} className={styles.row}>
                  <Text className={styles.label}>{a.kind}</Text>
                  <Text className={styles.value}>{a.originalName}</Text>
                </View>
              ))
            ) : (
              <Text className={styles.muted}>尚未上传材料</Text>
            )}
          </View>

          <View className={styles.card}>
            <Text className={styles.sectionTitle}>审核详情</Text>

            {!latestReview ? (
              <Text className={styles.muted}>暂无审核记录</Text>
            ) : (
              <>
                <View className={styles.tagRow}>
                  <Text className={tagClass(latestReview.summary)}>
                    {labelSummary(latestReview.summary)}
                  </Text>
                </View>

                {tasks.length ? (
                  tasks.map((t) => {
                    const lines = normalizeFindings(t.findings);
                    return (
                      <View key={t.id} className={styles.taskCard}>
                        <View className={styles.taskTitleRow}>
                          <Text className={styles.taskTitle}>{labelTaskType(t.type)}</Text>
                          <Text className={tagClass(t.status)}>{labelSummary(t.status)}</Text>
                        </View>
                        {lines.length ? (
                          <View className={styles.findingList}>
                            {lines.map((line, idx) => (
                              <Text key={`${t.id}_${idx}`} className={styles.finding}>
                                · {line}
                              </Text>
                            ))}
                          </View>
                        ) : (
                          <Text className={styles.muted}>无问题</Text>
                        )}
                      </View>
                    );
                  })
                ) : (
                  <Text className={styles.muted}>暂无任务</Text>
                )}
              </>
            )}

            <View className={styles.actions}>
              <Button className={styles.secondaryBtn} onClick={backToList}>
                返回列表
              </Button>
              <Button className={styles.primaryBtn} onClick={goSubmit}>
                去修改/补充
              </Button>
            </View>
          </View>
        </>
      )}
    </View>
  );
}
