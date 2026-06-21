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
('Kevin Odhiambo', 'Chairman', 'executive', NULL, 'Presiding officer of the KUPPET Migori Branch, providing overall leadership and direction to the union across the county.', NULL, '+254723608514', 1),
('Henry Otunga', 'Executive Secretary', 'executive', '/images/leaders/henri-otunga.jpg', 'Chief executive of the KUPPET Migori Branch, coordinating day-to-day operations, negotiations and member services.', NULL, '+254721808993', 2),
('May Abong''o', 'Treasurer', 'executive', NULL, 'Custodian of the branch finances, ensuring transparent and accountable management of union funds.', NULL, '+254722226590', 3),
('Rollex Owino', 'Assistant Executive Secretary', 'committee', NULL, 'Supports the Executive Secretary in coordinating branch operations and member services.', NULL, '+254721689112', 4),
('Bernard Obonyo', 'Vice Chairman', 'committee', NULL, 'Deputises for the Chairman and supports the overall leadership of the KUPPET Migori Branch.', NULL, '+254724612920', 5),
('Bon Ogalo', 'Assistant Treasurer', 'committee', NULL, 'Supports the Treasurer in the financial management and reporting of the branch.', NULL, '+254723052321', 6),
('Lilian Ogutu', 'Secretary, Gender', 'committee', NULL, 'Champions gender equity and the welfare of women educators within the KUPPET Migori Branch.', NULL, '+254711560019', 7),
('Fredrick Nyabuogi', 'Secretary, Secondary', 'committee', NULL, 'Represents and coordinates the interests of secondary school teacher members.', NULL, '+254716007037', 8),
('Philip Nyojero', 'Secretary, Tertiary', 'committee', NULL, 'Represents and coordinates the interests of tertiary and technical institution teacher members.', NULL, '+254704853949', 9),
('Dennish Ong''onge', 'Organizing Secretary', 'committee', NULL, 'Coordinates branch mobilisation, meetings and member engagement across Migori County.', NULL, '+254722397732', 10),
('Sharon Magai', 'Assistant Secretary, Gender 1', 'committee', NULL, 'Supports the Gender desk in advocating for inclusive policies and the welfare of members.', NULL, '+254791000243', 11),
('Mildred Adagala', 'Assistant Secretary, Gender 2', 'committee', NULL, 'Supports the Gender desk in advocating for inclusive policies and the welfare of members.', NULL, '+254725163344', 12),
('Harriet Okoth', 'Assistant Secretary, Gender 3', 'committee', NULL, 'Supports the Gender desk in advocating for inclusive policies and the welfare of members.', NULL, '+254708820801', 13),
('Boliph Odhiambo', 'Secretary, Junior School', 'committee', NULL, 'Represents and coordinates the interests of junior school teacher members.', NULL, '+254714623990', 14);
