import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Picker } from '@tarojs/components';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';
import { getPublicLeaderboard, type PublicLeaderboardResponse } from '../../services/publications';
import { getCurrentCompetition, type Competition } from '../../services/competitions';

type SubmissionCategory = 'DRAMA' | 'VIDEO' | 'SCIFI_PAINT' | 'CREATIVE_APP';

const defaultCategories: Array<{ label: string; value: SubmissionCategory }> = [
  { label: '科普剧', value: 'DRAMA' },
  { label: '科普视频', value: 'VIDEO' },
  { label: '科幻画', value: 'SCIFI_PAINT' },
  { label: '创意作品', value: 'CREATIVE_APP' },
];

function normalizeSubmissionCategory(raw: any): SubmissionCategory | null {
  if (raw === 'DRAMA' || raw === 'VIDEO' || raw === 'SCIFI_PAINT' || raw === 'CREATIVE_APP') return raw;
  return null;
}

function categoriesFromCompetitionConfig(config: any): Array<{ label: string; value: SubmissionCategory }> | null {
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
    const allowed = config.allowedCategories.map((v: any) => normalizeSubmissionCategory(v)).filter(Boolean) as SubmissionCategory[];
    const set = new Set(allowed);
    const out = defaultCategories.filter((o) => set.has(o.value));
    if (out.length) return out;
  }

  return null;
}

function labelCompetitionPhase(phase: string) {
  if (phase === 'DRAFT') return '未开始';
  if (phase === 'SUBMISSION') return '报名投稿';
  if (phase === 'JUDGING') return '评审中';
  if (phase === 'PUBLIC') return '公示中';
  if (phase === 'ENDED') return '已结束';
  return phase;
}

const PublicPage: React.FC = () => {
  const [competition, setCompetition] = useState<Competition | null>(null);
  const categories = useMemo(() => categoriesFromCompetitionConfig(competition?.config) ?? defaultCategories, [competition?.config]);
  const [categoryIndex, setCategoryIndex] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PublicLeaderboardResponse | null>(null);

  const safeCategoryIndex = useMemo(() => {
    const idx = Math.max(0, Math.min(categoryIndex, categories.length - 1));
    return Number.isFinite(idx) ? idx : 0;
  }, [categoryIndex, categories.length]);
  const category = useMemo(() => categories[safeCategoryIndex]?.value ?? 'VIDEO', [categories, safeCategoryIndex]);
  const categoryLabel = useMemo(() => categories[safeCategoryIndex]?.label ?? '科普视频', [categories, safeCategoryIndex]);

  useEffect(() => {
    let mounted = true;
    getCurrentCompetition()
      .then((c) => {
        if (!mounted) return;
        setCompetition(c);
      })
      .catch(() => {
        if (!mounted) return;
        setCompetition(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    getPublicLeaderboard({ category, page: 1, pageSize: 50 })
      .then((d) => {
        if (!mounted) return;
        setData(d);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : '加载失败');
        setData(null);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [category]);

  const title = data?.competition?.title ?? '公示榜单';
  useEffect(() => {
    Taro.setNavigationBarTitle({ title });
  }, [title]);

  useEffect(() => {
    if (safeCategoryIndex === categoryIndex) return;
    setCategoryIndex(safeCategoryIndex);
  }, [categoryIndex, safeCategoryIndex]);

  return (
    <View className={styles.container}>
      <View className={styles.card}>
        <Text className={styles.title}>公示榜单</Text>
        <Text className={styles.sub}>
          {data ? `当前赛事：${data.competition.title}（${labelCompetitionPhase(data.competition.phase)}）` : '加载赛事信息中...'}
        </Text>

        <View className={styles.field}>
          <Text className={styles.label}>类别</Text>
          <Picker
            mode="selector"
            range={categories.map((x) => x.label)}
            value={safeCategoryIndex}
            onChange={(e) => setCategoryIndex(Number(e.detail.value))}
          >
            <View className={styles.input}>{categoryLabel}</View>
          </Picker>
        </View>

        {error ? <Text className={styles.error}>{error}</Text> : null}
        {loading ? <Text className={styles.hint}>加载中...</Text> : null}

        {data ? (
          <View className={styles.list}>
            <Text className={styles.hint}>入榜最低评委提交数：{data.minScoreCount}</Text>
            {data.items.map((it) => (
              <View key={it.submissionId} className={styles.row}>
                <View className={styles.left}>
                  <Text className={styles.name}>{it.title || it.blindCode}</Text>
                  <Text className={styles.meta}>
                    盲评码：{it.blindCode} · 平均分：{it.score.avgTotal} · 提交数：{it.score.scoreCount}
                  </Text>
                </View>
                <Text className={styles.rank}>#{it.rank}</Text>
              </View>
            ))}
            {data.items.length === 0 ? <Text className={styles.hint}>暂无可公示的作品</Text> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default PublicPage;
