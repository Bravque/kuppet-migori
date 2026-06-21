-- ============================================================
-- Update branch officials / leadership (run ONCE on existing DBs)
-- Date: 2026-06-21
-- Replaces the placeholder leadership rows with the 14 real branch
-- officials. Run on the live Hostinger DB via phpMyAdmin -> SQL tab.
-- Fresh installs already include these via init.sql / init-hostinger.sql.
--
-- Grouping for the About page:
--   executive = the 3 principal officials (Chairman, Exec Sec, Treasurer)
--   committee = the remaining 11 officials
-- Phones stored in E.164 so the card "call" icon dials correctly.
-- ============================================================

DELETE FROM leadership;

INSERT INTO leadership (name, position, position_category, photo_url, bio, email, phone, display_order) VALUES
('Kevin Odhiambo', 'Chairman', 'executive', NULL, NULL, NULL, '+254723608514', 1),
('Henry Otunga', 'Executive Secretary', 'executive', '/images/leaders/henri-otunga.jpg', NULL, NULL, '+254721808993', 2),
('May Abong''o', 'Treasurer', 'executive', NULL, NULL, NULL, '+254722226590', 3),
('Rollex Owino', 'Assistant Executive Secretary', 'committee', NULL, NULL, NULL, '+254721689112', 4),
('Bernard Obonyo', 'Vice Chairman', 'committee', NULL, NULL, NULL, '+254724612920', 5),
('Bon Ogalo', 'Assistant Treasurer', 'committee', NULL, NULL, NULL, '+254723052321', 6),
('Lilian Ogutu', 'Secretary, Gender', 'committee', NULL, NULL, NULL, '+254711560019', 7),
('Fredrick Nyabuogi', 'Secretary, Secondary', 'committee', NULL, NULL, NULL, '+254716007037', 8),
('Philip Nyojero', 'Secretary, Tertiary', 'committee', NULL, NULL, NULL, '+254704853949', 9),
('Dennish Ong''onge', 'Organizing Secretary', 'committee', NULL, NULL, NULL, '+254722397732', 10),
('Sharon Magai', 'Assistant Secretary, Gender 1', 'committee', NULL, NULL, NULL, '+254791000243', 11),
('Mildred Adagala', 'Assistant Secretary, Gender 2', 'committee', NULL, NULL, NULL, '+254725163344', 12),
('Harriet Okoth', 'Assistant Secretary, Gender 3', 'committee', NULL, NULL, NULL, '+254708820801', 13),
('Boliph Odhiambo', 'Secretary, Junior School', 'committee', NULL, NULL, NULL, '+254714623990', 14);
