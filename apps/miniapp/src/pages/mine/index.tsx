import React, { useMemo, useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import styles from './index.module.scss';
import { me } from '../../services/auth';
import { useAuthStore } from '../../store/auth';

const MinePage: React.FC = () => {
  const tokens = useAuthStore((s) => s.tokens);
  const profile = useAuthStore((s) => s.me);
  const setMe = useAuthStore((s) => s.setMe);
  const clear = useAuthStore((s) => s.clear);
  const [loading, setLoading] = useState(false);

  const loggedIn = useMemo(() => Boolean(tokens?.accessToken), [tokens?.accessToken]);

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

  useDidShow(() => {
    void loadMe();
  });

  function goLogin() {
    Taro.navigateTo({ url: '/pages/login/index' });
  }

  function goMySubmissions() {
    Taro.navigateTo({ url: '/pages/submissions/index' });
  }

  function logout() {
    clear();
    Taro.showToast({ title: '已退出', icon: 'none' });
  }

  return (
    <View className={styles.container}>
      <View className={styles.profileCard}>
        <Text className={styles.title}>我的</Text>
        {!loggedIn ? (
          <Text className={styles.sub}>登录后可查看报名进度与评审通知。</Text>
        ) : (
          <Text className={styles.sub}>
            {loading ? '加载中...' : profile?.phone ? `手机号：${profile.phone}` : '已登录'}
          </Text>
        )}

        {!loggedIn ? (
          <Button className={styles.primaryBtn} onClick={goLogin}>
            去登录
          </Button>
        ) : (
          <Button className={styles.secondaryBtn} onClick={logout}>
            退出登录
          </Button>
        )}
      </View>

      <View className={styles.card}>
        <Text className={styles.cardTitle}>报名与作品</Text>
        <Text className={styles.cardDesc}>查看作品审核进度、退回原因与修改建议</Text>
        <Button className={styles.secondaryBtn} onClick={goMySubmissions}>
          我的作品
        </Button>
      </View>

      <View className={styles.card}>
        <Text className={styles.cardTitle}>角色与权限</Text>
        <Text className={styles.cardDesc}>
          {loggedIn ? profile?.roles?.join('、') || '-' : '未登录'}
        </Text>
      </View>

      <View className={styles.card}>
        <Text className={styles.cardTitle}>消息与通知</Text>
        <Text className={styles.cardDesc}>站内通知功能开发中</Text>
      </View>
    </View>
  );
};

export default MinePage;
