/** 
 * ENABLE REALTIME FOR CUP TABLES
 * 
 * Ejecuta este script en el SQL Editor de Supabase para activar la sincronización 
 * entre dispositivos (móvil y PC). Sin esto, los cambios no se verán al instante.
 */

-- Activar Realtime para las nuevas tablas de la copa
ALTER PUBLICATION supabase_realtime ADD TABLE public.cups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cup_players;

-- Asegurarse de que las tablas base también tienen Realtime activo (por si acaso)
-- Nota: Si alguna ya está en la publicación, este comando puede dar un aviso/error,
-- pero es importante que todas estas estén para el funcionamiento global.
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_stats;
