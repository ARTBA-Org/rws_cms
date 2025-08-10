import { supabase } from '../lib/supabase';

export async function getCourses(){
  const { data, error } = await supabase
    .from('courses')
    .select('id,title,description,thumbnail_id,updated_at')
    .order('updated_at',{ascending:false});
  if(error) throw error;
  return data ?? [];
}

export async function getCourseModules(courseId:number){
  const { data, error } = await supabase
    .from('courses_rels')
    .select('order, modules:modules ( id, title, description, module_thumbnail_id )')
    .eq('parent_id',courseId)
    .order('order',{ascending:true});
  if(error) throw error;
  return (data ?? []).map((r:any)=>r.modules);
}

export async function getModuleSlides(moduleId:number){
  const { data, error } = await supabase
    .from('modules_rels')
    .select('order, slides:slides ( id, title, description, type, image_id )')
    .eq('parent_id',moduleId)
    .order('order',{ascending:true});
  if(error) throw error;
  return (data ?? []).map((r:any)=>r.slides);
}

export async function getMediaUrls(mediaIds:number[]){
  if (mediaIds.length === 0) return {} as Record<number,string>;
  const { data, error } = await supabase
    .from('media')
    .select('id,url,sizes_thumbnail_url,sizes_card_url')
    .in('id',mediaIds);
  if(error) throw error;
  const map:Record<number,string>={};
  for(const m of (data ?? [])) map[m.id] = (m as any).sizes_card_url ?? (m as any).sizes_thumbnail_url ?? (m as any).url;
  return map;
}
