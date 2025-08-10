
import { useLocalSearchParams, Link } from 'expo-router';
import { FlatList, Text, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/api/client';

export default function CourseModules() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const { data } = useQuery({ queryKey: ['course-mods', courseId], queryFn: () => api.getCourseModules(courseId) });
  const mods = data ?? [];

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={mods}
      keyExtractor={(m) => String(m.id)}
      renderItem={({ item, index }) => (
        <Link href={`/learn/${courseId}/${item.id}`} asChild>
          <TouchableOpacity style={{ padding: 16, borderRadius: 12, backgroundColor: '#f2f2f2' }}>
            <Text style={{ fontWeight: '700', marginBottom: 4 }}>{index + 1}. {item.title}</Text>
            {item.description ? <Text style={{ color: '#666' }}>{item.description}</Text> : null}
          </TouchableOpacity>
        </Link>
      )}
      ListEmptyComponent={<Text style={{ padding: 24, textAlign: 'center' }}>No modules</Text>}
    />
  );
}
