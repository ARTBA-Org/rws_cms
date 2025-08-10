
import { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/api/client';
import { useProgress } from '@/src/state/useProgress';

export default function LearnIndex() {
  const { data } = useQuery({ queryKey: ['courses'], queryFn: () => api.listCourses(1, 20) });
  const { lastModuleId, todayCompleted, dailyGoal } = useProgress();
  const items = data ?? [];
  const continueHref = useMemo(() => (lastModuleId ? `/learn/any/${lastModuleId}` : null), [lastModuleId]);

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={items}
      keyExtractor={(i) => String(i.id)}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          {continueHref ? (
            <Link href={continueHref} asChild>
              <TouchableOpacity style={{ padding: 16, borderRadius: 12, backgroundColor: '#f9efe9' }}>
                <Text style={{ fontWeight: '700', marginBottom: 4 }}>Continue learning</Text>
                <Text style={{ color: '#7a4d33' }}>Jump back into your last micro‑module</Text>
              </TouchableOpacity>
            </Link>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ padding: 16, borderRadius: 12, backgroundColor: '#eef6ff', flex: 1 }}>
              <Text style={{ fontWeight: '700', marginBottom: 4 }}>Daily goal</Text>
              <Text style={{ color: '#2b6cb0' }}>{todayCompleted ? 'Done for today 🎉' : `1/${dailyGoal} micro‑module`}</Text>
            </View>
            <View style={{ padding: 16, borderRadius: 12, backgroundColor: '#eefcf1', flex: 1 }}>
              <Text style={{ fontWeight: '700', marginBottom: 4 }}>Streak</Text>
              <Text style={{ color: '#2f855a' }}>0 days</Text>
            </View>
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700' }}>Courses</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Link href={`/learn/${item.id}`} asChild>
          <TouchableOpacity style={{ padding: 16, borderRadius: 12, backgroundColor: '#f2f2f2' }}>
            <Text style={{ fontWeight: '700', marginBottom: 4 }}>{item.title}</Text>
            {item.description ? <Text style={{ color: '#666' }}>{item.description}</Text> : null}
          </TouchableOpacity>
        </Link>
      )}
      ListEmptyComponent={<Text style={{ padding: 24, textAlign: 'center' }}>No courses found</Text>}
    />
  );
}
