
import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, Stack } from 'expo-router';
import { View, Text, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/api/client';
import { useProgress } from '@/src/state/useProgress';
import { Image } from 'expo-image';

export default function ModulePlayer() {
  const { moduleId } = useLocalSearchParams<{ moduleId: string }>();
  const { data } = useQuery({ queryKey: ['module', moduleId], queryFn: () => api.getModule(moduleId) });
  const slides = data?.slides ?? [];
  const [index, setIndex] = useState(0);
  const { setLastPosition } = useProgress();

  useEffect(() => {
    setIndex(0);
  }, [moduleId]);

  useEffect(() => {
    const s = slides[index];
    if (!s) return;
    const percent = slides.length ? (index + 1) / slides.length : 0;
    setLastPosition(String(moduleId), String(s.id), percent);
  }, [index, slides, moduleId, setLastPosition]);

  const slide = slides[index];
  const progressText = useMemo(() => (slides.length ? `${index + 1}/${slides.length}` : ''), [index, slides.length]);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: slide?.title ?? 'Slide' }} />
      {slide ? (
        <View style={{ padding: 16, gap: 16, flex: 1 }}>
          {slide.imageUrl ? (
            <Image source={{ uri: slide.imageUrl }} style={{ width: '100%', height: 260, borderRadius: 12 }} contentFit="cover" />
          ) : null}
          {slide.description ? <Text style={{ fontSize: 16 }}>{slide.description}</Text> : null}
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <TouchableOpacity disabled={index === 0} onPress={() => setIndex(i => Math.max(0, i - 1))}>
              <Text style={{ color: index === 0 ? '#aaa' : '#f4511e' }}>Back</Text>
            </TouchableOpacity>
            <Text>{progressText}</Text>
            <TouchableOpacity disabled={index >= slides.length - 1} onPress={() => setIndex(i => Math.min(slides.length - 1, i + 1))}>
              <Text style={{ color: index >= slides.length - 1 ? '#aaa' : '#f4511e' }}>Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={{ padding: 24, textAlign: 'center' }}>No slides</Text>
      )}
    </View>
  );
}
