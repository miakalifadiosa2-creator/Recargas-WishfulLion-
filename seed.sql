-- Datos de EJEMPLO (solo se cargan si no hay juegos). Edítalos o bórralos desde el panel /admin.
INSERT INTO games (slug, name, cover_url, id_label, extra_field, currency_name, tag) VALUES
  ('free-fire', 'Free Fire', '/assets/games/free-fire.jpg', 'Player ID', NULL, 'Diamantes', NULL),
  ('mobile-legends', 'Mobile Legends', '/assets/games/mobile-legends.jpg', 'User ID', 'Zone ID', 'Diamantes', NULL),
  ('arena-breakout', 'Arena Breakout', '/assets/games/arena-breakout.jpg', 'UID', NULL, 'Bonds', 'nuevo'),
  ('blood-strike', 'Blood Strike', '/assets/games/blood-strike.svg', 'UID', NULL, 'Golds', 'oferta');
INSERT INTO packages (game_id, label, price_bs)
SELECT g.id, v.label, v.price FROM (VALUES
  ('free-fire', '100 + 10', 9.3), ('free-fire', '310 + 25', 27.6), ('free-fire', 'Tarjeta Semanal', 54), ('free-fire', '1580 + 110', 109.1),
  ('mobile-legends', '86 + 8', 12), ('mobile-legends', 'Pase Semanal', 25),
  ('arena-breakout', '60 Bonds', 8), ('arena-breakout', 'Pase de Batalla Premium', 45),
  ('blood-strike', '100 Golds', 10), ('blood-strike', 'Pase de Batalla', 40)
) AS v (slug, label, price) JOIN games g ON g.slug = v.slug;
