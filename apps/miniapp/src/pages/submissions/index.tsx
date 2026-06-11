import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import styles from './index.module.scss';
import { useAuthStore } from '../../store/auth';
import { http } from '../../services/http';
import type { SubmissionCategory, Submission } from '../../services/submissions';

type ReviewTask = { type: string; status: string };
type LatestReview = { id: string; summary: string; tasks: ReviewTask[] };
type SubmissionWithReview = Submission & { reviewCases?: LatestReview[] };

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

export default function SubmissionsPage() {
  const tokens = useAuthStore((s) => s.tokens);
  const [items, setItems] = useState<SubmissionWithReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loggedIn = useMemo(() => Boolean(tokens?.accessToken), [tokens?.accessToken]);

  async function load() {
    if (!loggedIn) return;
    setLoading(true);
    setError(null);
    try {
      const list = await http<SubmissionWithReview[]>('/submissions/my', { method: 'GET' });
      setItems(list);
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

  function goSubmit() {
    Taro.switchTab({ url: '/pages/submit/index' });
  }

  function goDetail(id: string) {
    Taro.navigateTo({ url: `/pages/submission-detail/index?id=${id}` });
  }

  return (
    <View className={styles.container}>
      <View className={styles.header}>
        <View>
          <Text className={styles.title}>我的作品</Text>
          <Text className={styles.hint}>
            {loggedIn ? '查看作品审核进度与退回原因' : '登录后可查看作品审核进度'}
          </Text>
        </View>
      </View>

      {!loggedIn ? (
        <View className={styles.card}>
          <Text className={styles.error}>请先登录</Text>
          <View className={styles.actions}>
            <Button className={styles.primaryBtn} onClick={goLogin}>
              去登录
            </Button>
            <Button className={styles.secondaryBtn} onClick={goSubmit}>
              去提交
            </Button>
          </View>
        </View>
      ) : (
        <View className={styles.card}>
          {error ? <Text className={styles.error}>{error}</Text> : null}
          {loading ? <Text className={styles.hint}>加载中...</Text> : null}
          {!loading && items.length === 0 ? <Text className={styles.empty}>暂无作品，先去提交一个作品吧</Text> : null}

          {items.map((it) => {
            const latest = it.reviewCases?.[0] ?? null;
            const tasks = latest?.tasks ?? [];
            return (
              <View key={it.id} className={styles.item}>
                <Text className={styles.itemTitle}>{it.title}</Text>
                <View className={styles.metaRow}>
                  <Text className={styles.tag}>{labelCategory(it.category)}</Text>
                  <Text className={styles.tag}>{labelStatus(it.status)}</Text>
                  {latest ? <Text className={tagClass(latest.summary)}>{labelSummary(latest.summary)}</Text> : null}
                </View>
                {tasks.length ? (
                  <View className={styles.metaRow}>
                    {tasks.map((t) => (
                      <Text key={t.type} className={tagClass(t.status)}>
                        {labelTaskType(t.type)}:{labelSummary(t.status)}
                      </Text>
                    ))}
                  </View>
                ) : (
                  <View className={styles.metaRow}>
                    <Text className={styles.tag}>暂无审核记录</Text>
                  </View>
                )}
                <View className={styles.actions}>
                  <Button className={styles.primaryBtn} onClick={() => goDetail(it.id)}>
                    查看详情
                  </Button>
                  <Button className={styles.secondaryBtn} onClick={goSubmit}>
                    去修改/补充
                  </Button>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

