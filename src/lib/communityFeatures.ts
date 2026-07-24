import { supabase } from './supabase';

export async function getEventCreationEnabled() {
  const { data, error } = await supabase.rpc('get_event_creation_feature_enabled');
  if (error) throw error;
  return Boolean(data);
}

export async function setEventCreationEnabled(enabled: boolean) {
  const { data, error } = await supabase.rpc('super_admin_set_event_creation_enabled', {
    p_enabled: enabled
  });
  if (error) throw error;
  return Boolean(data);
}
