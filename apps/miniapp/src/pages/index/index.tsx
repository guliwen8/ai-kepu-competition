import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import styles from './index.module.scss';
import { getCurrentCompetition, type Competition } from '../../services/competitions';

function labelCompetitionPhase(phase: string) {
  if (phase === 'DRAFT') return '未开始';
  if (phase === 'SUBMISSION') return '报名投稿';
  if (phase === 'JUDGING') return '评审中';
  if (phase === 'PUBLIC') return '公示中';
  if (phase === 'ENDED') return '已结束';
  return phase;
}

const Index: React.FC = () => {
  const [competition, setCompetition] = useState<Competition | null>(null);

  async function loadCompetition() {
    try {
      const c = await getCurrentCompetition();
      setCompetition(c);
    } catch {
      setCompetition(null);
    }
  }

  useDidShow(() => {
    void loadCompetition();
  });

  useEffect(() => {
    void loadCompetition();
  }, []);

  const phaseLabel = useMemo(
    () => (competition?.phase ? labelCompetitionPhase(competition.phase) : '未开始'),
    [competition?.phase],
  );
  const submissionLabel = useMemo(() => {
    if (!competition) return '未知';
    return competition.phase === 'SUBMISSION' ? '开放中' : '未开放';
  }, [competition]);
  const publicLabel = useMemo(() => {
    if (!competition) return '未知';
    return competition.phase === 'PUBLIC' ? '开放中' : '未开放';
  }, [competition]);

  const goSubmit = () => {
    Taro.switchTab({ url: '/pages/submit/index' });
  };
  const goPublic = () => {
    Taro.navigateTo({ url: '/pages/public/index' });
  };

  return (
    <View className={styles.container}>
      <View className={styles.hero}>
        <Text className={styles.title}>绍兴市高校 AI 科普作品创作大赛</Text>
        <Text className={styles.subtitle}>在线报名、材料提交、自动合规校验与进度通知</Text>

        <Button className={styles.primaryBtn} onClick={goSubmit}>
          立即报名
        </Button>
        <Button className={styles.primaryBtn} onClick={goPublic}>
          公示榜单
        </Button>
      </View>

      <View className={styles.card}>
        <Text className={styles.cardTitle}>赛事进度</Text>
        <View className={styles.kv}>
          <View className={styles.kvItem}>
            <Text className={styles.kvLabel}>报名</Text>
            <Text className={styles.kvValue}>{submissionLabel}</Text>
          </View>
          <View className={styles.kvItem}>
            <Text className={styles.kvLabel}>审核</Text>
            <Text className={styles.kvValue}>自动+人工</Text>
          </View>
          <View className={styles.kvItem}>
            <Text className={styles.kvLabel}>评审</Text>
            <Text className={styles.kvValue}>{phaseLabel}</Text>
          </View>
          <View className={styles.kvItem}>
            <Text className={styles.kvLabel}>公示</Text>
            <Text className={styles.kvValue}>{publicLabel}</Text>
          </View>
        </View>
      </View>

      <View className={styles.card}>
        <Text className={styles.cardTitle}>最新公告</Text>
        <Text className={styles.cardDesc}>
          请关注赛事通知与时间节点，按要求提交图文或视频作品材料。
        </Text>
      </View>
    </View>
  );
};

export default Index;
