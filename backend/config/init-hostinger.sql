-- KUPPET Migori Database Schema — Hostinger import version
-- DATABASE ALREADY SELECTED via phpMyAdmin — do not run CREATE DATABASE or USE here

-- ============================================
-- CORE TABLES
-- ============================================

-- Admin users
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('super_admin','branch_officer','branch_secretary','content_admin') NOT NULL DEFAULT 'branch_officer',
  is_active BOOLEAN DEFAULT TRUE,
  failed_login_attempts INT DEFAULT 0,
  locked_until TIMESTAMP NULL,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Leadership/Officials
CREATE TABLE IF NOT EXISTS leadership (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  position VARCHAR(200) NOT NULL,
  position_category ENUM('executive','committee','trustee') DEFAULT 'executive',
  photo_url VARCHAR(500),
  bio TEXT,
  email VARCHAR(255),
  phone VARCHAR(30),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- News articles
CREATE TABLE IF NOT EXISTS news (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) UNIQUE NOT NULL,
  excerpt TEXT,
  content LONGTEXT NOT NULL,
  category ENUM('news','announcement','circular','press_release','event','sport_entertainment') DEFAULT 'news',
  featured_image VARCHAR(500),
  image_2 VARCHAR(500),
  document_url VARCHAR(500),
  document_name VARCHAR(255),
  author VARCHAR(150) DEFAULT 'KUPPET Migori',
  is_featured BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT TRUE,
  views INT DEFAULT 0,
  tags VARCHAR(500),
  published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  end_date DATE,
  venue VARCHAR(300),
  venue_address VARCHAR(500),
  event_type ENUM('meeting','workshop','seminar','agm','strike','other') DEFAULT 'meeting',
  is_featured BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT TRUE,
  registration_link VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Teaching resources
CREATE TABLE IF NOT EXISTS resources (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  category ENUM('curriculum','circular','moe_document','tsc_resource','professional_dev','teaching_material','legal','policy','sport_entertainment') DEFAULT 'teaching_material',
  subject VARCHAR(150),
  grade_level VARCHAR(100),
  file_url VARCHAR(500),
  file_type VARCHAR(20),
  file_size VARCHAR(30),
  external_url VARCHAR(500),
  download_count INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT TRUE,
  uploaded_by VARCHAR(150) DEFAULT 'KUPPET Migori',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Scholarships
CREATE TABLE IF NOT EXISTS scholarships (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(500) NOT NULL,
  provider VARCHAR(300) NOT NULL,
  description TEXT NOT NULL,
  eligibility TEXT,
  benefits TEXT,
  application_deadline DATE,
  application_link VARCHAR(500),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(30),
  scholarship_type ENUM('kcse','kjsea','dte') DEFAULT 'kcse',
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Advocacy items
CREATE TABLE IF NOT EXISTS advocacy (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) UNIQUE NOT NULL,
  content LONGTEXT NOT NULL,
  category ENUM('rights','legal','labour','policy','news','report') DEFAULT 'rights',
  document_url VARCHAR(500),
  is_featured BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Contact form submissions
CREATE TABLE IF NOT EXISTS contacts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  subject VARCHAR(300),
  message TEXT NOT NULL,
  category ENUM('general','membership','bbf','advocacy','resources','complaint','other') DEFAULT 'general',
  status ENUM('new','read','replied','closed') DEFAULT 'new',
  admin_reply TEXT,
  replied_at TIMESTAMP NULL,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Site settings / stats
CREATE TABLE IF NOT EXISTS settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  description VARCHAR(300),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Homepage announcement ticker items (editable from the admin portal)
CREATE TABLE IF NOT EXISTS announcements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  text VARCHAR(500) NOT NULL,
  link VARCHAR(500) NULL,
  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_announcements_active (is_active, sort_order)
);

-- ============================================
-- MEMBERSHIP TABLES
-- ============================================

-- Registered teacher-members
CREATE TABLE IF NOT EXISTS members (
  id INT PRIMARY KEY AUTO_INCREMENT,
  member_number VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  tsc_number VARCHAR(50) UNIQUE NOT NULL,
  national_id VARCHAR(30) UNIQUE NOT NULL,
  employment_number VARCHAR(50),
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  gender ENUM('male','female','other') NOT NULL,
  date_of_birth DATE NOT NULL,
  school_name VARCHAR(300) NOT NULL,
  sub_county VARCHAR(150) NOT NULL,
  school_category ENUM('senior_school','junior_school','tertiary_school'),
  job_group ENUM('B5','C1','C2','C3','C4','C5','D1','D2','D3','D4','D5'),
  passport_photo_url VARCHAR(500),
  national_id_url VARCHAR(500),
  status ENUM('pending_approval','approved','rejected','suspended') DEFAULT 'pending_approval',
  rejection_reason TEXT,
  approved_by INT,
  approved_at TIMESTAMP NULL,
  last_login TIMESTAMP NULL,
  failed_login_attempts INT DEFAULT 0,
  locked_until TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- BBF (Benevolent & Burial Fund) Claims
CREATE TABLE IF NOT EXISTS bbf_claims (
  id INT PRIMARY KEY AUTO_INCREMENT,
  claim_number VARCHAR(20) UNIQUE NOT NULL,
  member_id INT NOT NULL,
  claim_type ENUM('death','retirement') NOT NULL,
  deceased_name VARCHAR(200),
  tsc_no VARCHAR(50),
  sub_county VARCHAR(100),
  school VARCHAR(200),
  school_category ENUM('senior_school','junior_school','tertiary_school'),
  relationship VARCHAR(100),
  date_of_death DATE,
  description TEXT,
  amount_requested DECIMAL(12,2),
  amount_approved DECIMAL(12,2),
  status ENUM('draft','submitted','under_review','approved','rejected','paid') DEFAULT 'draft',
  assigned_to INT,
  reviewed_by INT,
  reviewer_notes TEXT,
  payment_reference VARCHAR(100),
  payment_date DATE,
  submitted_at TIMESTAMP NULL,
  reviewed_at TIMESTAMP NULL,
  resolved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Supporting documents for BBF claims
CREATE TABLE IF NOT EXISTS bbf_claim_documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  claim_id INT NOT NULL,
  doc_type ENUM('tsc_slip','burial_permit','birth_notification','letter_from_principal','other') NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255),
  file_size INT,
  uploaded_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Append-only status transition log for BBF claims
CREATE TABLE IF NOT EXISTS bbf_claim_timeline (
  id INT PRIMARY KEY AUTO_INCREMENT,
  claim_id INT NOT NULL,
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  comment TEXT,
  changed_by INT NOT NULL,
  changed_by_type ENUM('admin','member') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Member scholarship applications
CREATE TABLE IF NOT EXISTS scholarship_applications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  application_number VARCHAR(20) UNIQUE NOT NULL,
  member_id INT NOT NULL,
  scholarship_id INT NOT NULL,
  applicant_name VARCHAR(200) NOT NULL,
  institution VARCHAR(300),
  course VARCHAR(300),
  year_of_study TINYINT,
  academic_year VARCHAR(10),
  essay TEXT,
  status ENUM('applied','under_review','approved','rejected') DEFAULT 'applied',
  reviewer_notes TEXT,
  reviewed_by INT,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_member_scholarship (member_id, scholarship_id)
);

-- Supporting documents for scholarship applications
CREATE TABLE IF NOT EXISTS scholarship_application_documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  application_id INT NOT NULL,
  doc_type ENUM('letter_of_application','tsc_slip','kcse_cert','admission_letter','fee_structure','recommendation','other') NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255),
  file_size INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- In-app notifications for members
CREATE TABLE IF NOT EXISTS notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  member_id INT NOT NULL,
  type ENUM('bbf_claim','scholarship','general','system') NOT NULL,
  title VARCHAR(300) NOT NULL,
  body TEXT,
  reference_id INT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- SMS & COMMUNICATION TABLES
-- ============================================

-- SMS delivery log (TalkSasa)
CREATE TABLE IF NOT EXISTS sms_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  recipient_phone VARCHAR(30) NOT NULL,
  recipient_name VARCHAR(200),
  member_id INT,
  message TEXT NOT NULL,
  message_type ENUM('individual','bulk','group','template') DEFAULT 'individual',
  template_id INT,
  status ENUM('queued','sent','delivered','failed') DEFAULT 'queued',
  talksasa_ref VARCHAR(100),
  error_message TEXT,
  sent_by INT NOT NULL,
  sent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email delivery log (progress/history for individual, bulk & group email sends)
CREATE TABLE IF NOT EXISTS email_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  recipient_email VARCHAR(254) NOT NULL,
  recipient_name VARCHAR(200),
  member_id INT,
  subject VARCHAR(255) NOT NULL,
  message TEXT,
  message_type ENUM('individual','bulk','group') DEFAULT 'individual',
  status ENUM('sent','failed','skipped') DEFAULT 'sent',
  error_message TEXT,
  sent_by INT NOT NULL,
  sent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_logs_status (status),
  INDEX idx_email_logs_created (created_at)
);

-- Reusable SMS templates
CREATE TABLE IF NOT EXISTS sms_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  body TEXT NOT NULL,
  category ENUM('bbf','scholarship','general','system') DEFAULT 'general',
  created_by INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- SECURITY & AUDIT TABLES
-- ============================================

-- Append-only audit trail for all mutations
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  actor_id INT NOT NULL,
  actor_type ENUM('admin','member') NOT NULL,
  actor_name VARCHAR(200),
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100),
  resource_id INT,
  old_value JSON,
  new_value JSON,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Login history for both admin and member accounts
CREATE TABLE IF NOT EXISTS login_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  user_type ENUM('admin','member') NOT NULL,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  status ENUM('success','failed','locked') DEFAULT 'success',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin 2FA secrets (AES-256-GCM encrypted)
CREATE TABLE IF NOT EXISTS admin_2fa (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNIQUE NOT NULL,
  secret VARCHAR(500) NOT NULL,
  is_enabled BOOLEAN DEFAULT FALSE,
  backup_codes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Court cases tracker (branch officers) + dated per-case updates log.
CREATE TABLE IF NOT EXISTS court_cases (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_number VARCHAR(100),
  title VARCHAR(300) NOT NULL,
  court VARCHAR(200),
  case_type ENUM('employment','disciplinary','criminal','civil','constitutional','appeal','other') DEFAULT 'employment',
  plaintiff VARCHAR(300),
  defendant VARCHAR(300),
  status ENUM('open','ongoing','on_hold','closed') DEFAULT 'open',
  outcome ENUM('pending','won','lost','settled','withdrawn','dismissed') DEFAULT 'pending',
  filing_date DATE NULL,
  next_hearing_date DATE NULL,
  description TEXT,
  officer_id INT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_court_cases_status (status),
  INDEX idx_court_cases_hearing (next_hearing_date)
);

CREATE TABLE IF NOT EXISTS court_case_updates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_id INT NOT NULL,
  update_date DATE NOT NULL,
  note TEXT NOT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_case_updates_case (case_id)
);

CREATE TABLE IF NOT EXISTS court_case_documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_id INT NOT NULL,
  label VARCHAR(200),
  file_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255),
  file_size INT,
  uploaded_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_case_docs_case (case_id)
);

-- Disciplinary cases (teacher disciplinary matters — TSC/employer process)
CREATE TABLE IF NOT EXISTS disciplinary_cases (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_ref VARCHAR(100),
  teacher_name VARCHAR(200) NOT NULL,
  tsc_number VARCHAR(50),
  school VARCHAR(300),
  sub_county VARCHAR(150),
  offence_category ENUM('misconduct','absenteeism','exam_irregularity','financial',
                        'insubordination','negligence','criminal','other') DEFAULT 'misconduct',
  description TEXT,
  status ENUM('reported','query_issued','interdicted','hearing','determined','appealed','closed') DEFAULT 'reported',
  outcome ENUM('pending','warning','suspension','dismissal','reinstated','cleared','other') DEFAULT 'pending',
  reported_date DATE NULL,
  interdiction_date DATE NULL,
  hearing_date DATE NULL,
  resolved_date DATE NULL,
  officer_id INT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_disc_cases_status (status),
  INDEX idx_disc_cases_hearing (hearing_date)
);

CREATE TABLE IF NOT EXISTS disciplinary_case_updates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_id INT NOT NULL,
  update_date DATE NOT NULL,
  note TEXT NOT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_disc_updates_case (case_id)
);

CREATE TABLE IF NOT EXISTS disciplinary_case_documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_id INT NOT NULL,
  label VARCHAR(200),
  file_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255),
  file_size INT,
  uploaded_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_disc_docs_case (case_id)
);

-- ============================================
-- SEED DATA
-- ============================================

-- Default super admin — seeded INACTIVE with an UNUSABLE password hash ('!').
-- No login is possible until an operator sets a real password and activates it.
-- This avoids shipping a known/default credential in a public repository.
-- After install, set a strong password (bcrypt hash) and activate, e.g. via SQL:
--   UPDATE users SET password = '<bcrypt-hash>', is_active = 1,
--          failed_login_attempts = 0, locked_until = NULL
--   WHERE email = 'admin@kuppetmigori.co.ke';
INSERT IGNORE INTO users (name, email, password, role, is_active) VALUES
('Admin KUPPET', 'admin@kuppetmigori.co.ke', '!', 'super_admin', 0);

-- Site settings
INSERT IGNORE INTO settings (setting_key, setting_value, description) VALUES
('total_members', '4500', 'Total union members'),
('schools_covered', '320', 'Number of schools covered'),
('years_serving', '30', 'Years in service'),
('resources_count', '250', 'Number of resources available'),
('chairman_message', 'On behalf of the KUPPET Migori Branch Executive Committee, I extend a warm welcome to all our members and visitors. Our union stands firmly committed to the professional welfare, rights, and dignity of every post-primary education teacher in Migori County. Together, we build a stronger, more equitable education system for Kenya.', 'Chairman welcome message'),
('chairman_name', 'Henri Otunga', 'Branch Chairman name'),
('chairman_title', 'Branch Executive Secretary & Chairperson, KUPPET Migori', 'Chairman title'),
('member_seq', '0', 'Member number sequence counter'),
('bbf_seq', '0', 'BBF claim number sequence counter'),
('schapp_seq', '0', 'Scholarship application number sequence counter');

-- Homepage ticker announcements
INSERT IGNORE INTO announcements (id, text, link, sort_order, is_active) VALUES
(1, 'AGM 2026 scheduled for July 20 – All members must attend', NULL, 1, 1),
(2, 'New TSC transfer guidelines effective June 2026', '/pages/news.html', 2, 1),
(3, 'KUPPET National Scholarship applications open until July 31', NULL, 3, 1),
(4, 'Teacher Wellness Program launching – Free medical check-ups available', NULL, 4, 1),
(5, 'BBF Claim forms updated – Visit branch office for new forms', NULL, 5, 1);

-- Leadership data
INSERT IGNORE INTO leadership (name, position, position_category, photo_url, bio, email, phone, display_order) VALUES
('Kevin Odhiambo', 'Chairman', 'executive', NULL, NULL, 'info@kuppetmigori.co.ke', '+254723608514', 1),
('Henry Otunga', 'Executive Secretary', 'executive', '/images/leaders/henri-otunga.jpg', NULL, 'info@kuppetmigori.co.ke', '+254721808993', 2),
('May Abong''o', 'Treasurer', 'executive', NULL, NULL, 'info@kuppetmigori.co.ke', '+254722226590', 3),
('Rollex Owino', 'Assistant Executive Secretary', 'committee', NULL, NULL, 'info@kuppetmigori.co.ke', '+254721689112', 4),
('Bernard Obonyo', 'Vice Chairman', 'committee', NULL, NULL, 'info@kuppetmigori.co.ke', '+254724612920', 5),
('Bon Ogalo', 'Assistant Treasurer', 'committee', NULL, NULL, 'info@kuppetmigori.co.ke', '+254723052321', 6),
('Lilian Ogutu', 'Secretary, Gender', 'committee', NULL, NULL, 'info@kuppetmigori.co.ke', '+254711560019', 7),
('Fredrick Nyabuogi', 'Secretary, Secondary', 'committee', NULL, NULL, 'info@kuppetmigori.co.ke', '+254716007037', 8),
('Philip Nyojero', 'Secretary, Tertiary', 'committee', NULL, NULL, 'info@kuppetmigori.co.ke', '+254704853949', 9),
('Dennish Ong''onge', 'Organizing Secretary', 'committee', NULL, NULL, 'info@kuppetmigori.co.ke', '+254722397732', 10),
('Sharon Magai', 'Assistant Secretary, Gender 1', 'committee', NULL, NULL, 'info@kuppetmigori.co.ke', '+254791000243', 11),
('Mildred Adagala', 'Assistant Secretary, Gender 2', 'committee', NULL, NULL, 'info@kuppetmigori.co.ke', '+254725163344', 12),
('Harriet Okoth', 'Assistant Secretary, Gender 3', 'committee', NULL, NULL, 'info@kuppetmigori.co.ke', '+254708820801', 13),
('Boliph Odhiambo', 'Secretary, Junior School', 'committee', NULL, NULL, 'info@kuppetmigori.co.ke', '+254714623990', 14);

-- News articles
INSERT IGNORE INTO news (title, slug, excerpt, content, category, is_featured, author, published_at) VALUES
('KUPPET Migori Secures 15% Salary Enhancement for Teachers', 'kuppet-migori-secures-salary-enhancement', 'After rigorous negotiations with the Teachers Service Commission, KUPPET Migori Branch has secured a significant salary enhancement for post-primary teachers in Migori County.', '<p>After months of rigorous negotiations with the Teachers Service Commission (TSC), the KUPPET Migori Branch is proud to announce a landmark achievement — a 15% salary enhancement for all post-primary teachers effective from the next financial year.</p><p>The Branch Executive Secretary, Henri Otunga, led a dedicated negotiating team that presented compelling evidence of teachers'' contribution to national development and the cost of living adjustments required in Migori County.</p><p>"This is a victory for every teacher in Migori. We have been consistent in our advocacy, and today that persistence has paid off," said Henri Otunga.</p><p>The salary enhancement will affect over 4,500 union members across Migori County, providing much-needed relief amid rising living costs.</p>', 'news', TRUE, 'KUPPET Migori Communications', '2026-05-15 09:00:00'),
('Annual General Meeting 2026 - Notice to All Members', 'agm-2026-notice', 'The Branch Annual General Meeting is scheduled for July 20, 2026. All members are urged to attend this important assembly.', '<p>Dear KUPPET Migori Members,</p><p>This is to inform all branch members that the Annual General Meeting (AGM) for 2026 will be held on <strong>Saturday, July 20, 2026</strong>, at the Migori County Education Offices, Migori Town.</p><p>The AGM will cover the following agenda:</p><ul><li>Branch Chairperson''s Annual Report</li><li>Financial Report by the Branch Treasurer</li><li>Election of Executive Committee Members</li><li>Welfare Fund Updates</li><li>BBF Claims Status Report</li><li>Professional Development Programs Review</li><li>Any Other Business</li></ul><p>Registration begins at 8:00 AM. The meeting commences at 9:00 AM. Attendance is mandatory for all sub-branch representatives.</p>', 'announcement', TRUE, 'KUPPET Migori Secretariat', '2026-06-01 08:00:00'),
('TSC Issues New Guidelines on Teacher Transfers', 'tsc-transfer-guidelines-2026', 'The Teachers Service Commission has released updated guidelines governing teacher transfers. Members are advised to familiarize themselves with these new regulations.', '<p>The Teachers Service Commission (TSC) has released updated guidelines governing teacher transfers effective June 2026. KUPPET Migori Branch has reviewed these guidelines and provides the following summary for members.</p><p><strong>Key Changes:</strong></p><ul><li>Transfer applications now processed online through TSC portal</li><li>Hardship allowance criteria expanded to include more remote areas</li><li>Spousal posting consideration now a formal policy</li><li>Processing time reduced from 90 to 60 days</li></ul><p>Members requiring assistance with transfer applications are encouraged to visit the branch office for support.</p>', 'circular', FALSE, 'KUPPET Migori', '2026-05-28 10:00:00'),
('KUPPET Migori Launches Teacher Wellness Program', 'teacher-wellness-program-launch', 'The branch has launched a comprehensive wellness program addressing physical, mental, and financial health of our teacher members across Migori County.', '<p>KUPPET Migori Branch is pleased to announce the launch of the Teacher Wellness Program (TWP) — a holistic initiative designed to support the physical, mental, and financial well-being of our members.</p><p>The program, funded through the branch welfare fund with support from KUPPET National, will provide:</p><ul><li>Free medical check-ups twice annually</li><li>Mental health counseling services</li><li>Financial literacy workshops</li><li>Retirement planning guidance</li><li>Legal aid clinics</li></ul>', 'news', TRUE, 'KUPPET Migori', '2026-05-10 11:00:00'),
('Circular: BBF Claim Processing - New Requirements', 'bbf-claim-processing-circular', 'Important circular regarding updated BBF claim processing requirements effective immediately.', '<p>To all KUPPET Migori Members,</p><p>This circular outlines the updated requirements for processing Benevolent and Burial Fund (BBF) claims effective June 2026.</p><p><strong>Required Documents:</strong></p><ul><li>Original death certificate (certified copy)</li><li>Deceased member''s TSC number confirmation</li><li>Next of kin identification documents</li><li>Bank account details of beneficiary</li><li>Completed BBF claim form (available at branch office)</li><li>Three passport photos of claimant</li></ul><p>Claims submitted without complete documentation will not be processed. Members are urged to advise their next of kin on the claim process.</p>', 'circular', FALSE, 'KUPPET Migori Secretariat', '2026-06-05 09:00:00');

-- Events
INSERT IGNORE INTO events (title, description, event_date, event_time, venue, event_type, is_featured) VALUES
('KUPPET Migori Annual General Meeting 2026', 'Annual General Meeting for all KUPPET Migori branch members. Sub-branch representatives must attend. Items include election of officials, financial report, and strategic planning for 2026/2027.', '2026-07-20', '09:00:00', 'Migori County Education Offices, Migori Town', 'agm', TRUE),
('Teacher Professional Development Workshop - CBC', 'A comprehensive workshop on Competency Based Curriculum (CBC) implementation strategies for secondary school teachers. Facilitated by KIE curriculum specialists.', '2026-06-28', '08:30:00', 'Ranen Technical Training Institute, Ranen', 'workshop', TRUE),
('BBF Claims Awareness Seminar', 'Seminar to educate members on BBF claim procedures, documentation requirements, and beneficiary nomination. All members encouraged to attend.', '2026-07-05', '10:00:00', 'KUPPET Migori Branch Office, Migori Town', 'seminar', FALSE),
('Sub-Branch Executive Meeting - July', 'Monthly sub-branch executives coordination meeting. Agenda includes membership updates, welfare cases, and advocacy updates.', '2026-07-12', '14:00:00', 'KUPPET Migori Branch Office', 'meeting', FALSE),
('Labour Relations Legal Clinic', 'Free legal clinic for members facing workplace issues including unfair dismissal, harassment, and disciplinary matters. Facilitated by KUPPET legal team.', '2026-07-25', '09:00:00', 'Migori Law Courts, Migori Town', 'seminar', TRUE),
('Inter-Schools Games - KUPPET Migori Cup', 'Annual inter-schools sports competition organized by KUPPET Migori for post-primary school students. Soccer, athletics, and volleyball categories.', '2026-08-10', '07:00:00', 'Migori Stadium, Migori Town', 'other', FALSE);

-- Resources
INSERT IGNORE INTO resources (title, description, category, subject, grade_level, file_type, is_featured) VALUES
('KICD CBC Secondary School Curriculum Framework', 'Complete curriculum framework for Competency Based Curriculum implementation at secondary school level as issued by Kenya Institute of Curriculum Development.', 'curriculum', 'General', 'Secondary', 'PDF', TRUE),
('TSC Code of Conduct and Ethics for Teachers 2023', 'Official Teachers Service Commission Code of Conduct and Ethics document that all teachers must adhere to.', 'tsc_resource', 'Professional', 'All', 'PDF', TRUE),
('Ministry of Education Circular - School Examination Guidelines 2026', 'Updated examination guidelines and regulations from the Ministry of Education for the 2026 academic year.', 'moe_document', 'Examinations', 'All', 'PDF', TRUE),
('Teachers'' Rights Under Kenyan Labour Law - Guide', 'Comprehensive guide to teacher rights under the Employment Act 2007, Labour Relations Act 2007, and TSC Act 2012.', 'legal', 'Legal', 'All', 'PDF', FALSE),
('Effective Classroom Management Strategies', 'Professional development resource covering modern classroom management techniques for secondary school teachers.', 'professional_dev', 'Pedagogy', 'Secondary', 'PDF', FALSE),
('KUPPET BBF Claim Form 2026', 'Official Benevolent and Burial Fund claim form for KUPPET members. Complete all sections before submission.', 'circular', 'Welfare', 'All', 'PDF', TRUE),
('Grade 9 Mathematics Teacher Guide - CBC', 'Comprehensive teacher''s guide for delivering Grade 9 Mathematics under the CBC framework.', 'teaching_material', 'Mathematics', 'Grade 9', 'PDF', FALSE),
('English Language Teaching Methodology - Secondary', 'Resource for English teachers on modern language teaching methodologies aligned with CBC objectives.', 'teaching_material', 'English', 'Secondary', 'PDF', FALSE),
('Science Practical Work Safety Guidelines', 'Safety protocols and guidelines for conducting practical work in science laboratories in secondary schools.', 'teaching_material', 'Science', 'Secondary', 'PDF', FALSE),
('Teacher Pension Guide - NSSF & NHIF 2026', 'Updated guide on NSSF and NHIF contributions, benefits, and retirement planning for teachers.', 'professional_dev', 'Welfare', 'All', 'PDF', FALSE);

-- Scholarships
INSERT IGNORE INTO scholarships (title, provider, description, eligibility, benefits, application_deadline, scholarship_type, is_featured, is_active) VALUES
('KUPPET National Scholarship Fund 2026', 'KUPPET National', 'Annual scholarship fund for children of KUPPET members pursuing university education. Awarded based on academic merit and financial need.', 'Children of fully paid-up KUPPET members. Must have scored B+ or above in KCSE. Must be joining university for the first time. Family income below KES 50,000 per month.', 'KES 50,000 annual tuition support. Renewable for up to 4 years subject to academic performance. Priority placement in KUPPET mentorship program.', '2026-07-31', 'kcse', TRUE, TRUE),
('Teachers Welfare Fund Education Grant', 'TSC Teachers Welfare Fund', 'Education grants for children of TSC teachers pursuing technical and vocational training or university education.', 'Children of TSC-employed teachers (KUPPET members). Must be enrolled in accredited institution. Must not be benefiting from another TSC scholarship.', 'KES 30,000 one-time grant. Applicable to tuition fees, books, and accommodation.', '2026-08-15', 'dte', TRUE, TRUE),
('Migori County Government Bursary Fund', 'Migori County Government', 'County government bursary for students from Migori County pursuing higher education, open to children of teachers among others.', 'Residents of Migori County. Must have joined Form 1 or university. Financial need demonstrated through affidavit. Priority to orphans and vulnerable children.', 'KES 10,000 - 30,000 depending on need assessment. Renewable annually subject to availability of funds.', '2026-09-30', 'kjsea', FALSE, TRUE),
('CBA Foundation Teacher Children Scholarship', 'CBA Foundation (Commercial Bank of Africa)', 'CBA Foundation scholarship targeting children of teachers across Kenya, promoting access to quality higher education.', 'Children of teachers (public or private). Scored minimum B plain in KCSE. Must be joining university or TVET. No age limit.', 'Full tuition for 4 years at public universities. KES 15,000 monthly stipend. Laptop and academic support.', '2026-06-30', 'kcse', TRUE, TRUE),
('Government of Kenya Postgraduate Scholarship', 'Ministry of Education - HELB', 'Government postgraduate scholarship for Kenyan professionals including teachers seeking advanced degrees locally or internationally.', 'Kenyan citizen. Currently employed in public sector. Minimum 2 years work experience. Unconditional admission to accredited postgraduate program. Below 45 years of age.', 'Full tuition fees at public universities. KES 20,000 monthly stipend. Research allowance for PhD candidates.', '2026-07-15', 'kcse', FALSE, TRUE);

-- Advocacy content
INSERT IGNORE INTO advocacy (title, slug, content, category, is_featured, is_published) VALUES
('Know Your Rights as a Teacher in Kenya', 'know-your-rights-teacher-kenya', '<h2>Constitutional Protections</h2><p>Every teacher in Kenya is protected under Article 41 of the Constitution which guarantees fair labour practices including the right to form and join trade unions, the right to strike, and the right to collective bargaining.</p><h2>Employment Act 2007</h2><p>Key protections under the Employment Act include:<br>• Right to a written employment contract<br>• Protection from unfair dismissal<br>• Maternity and paternity leave entitlements<br>• Annual leave of not less than 21 days<br>• Protection from discrimination</p><h2>Labour Relations Act 2007</h2><p>This Act governs collective bargaining between KUPPET and TSC, establishing the framework for Collective Bargaining Agreements (CBAs) that determine salary scales, allowances, and working conditions for teachers.</p><h2>TSC Act 2012</h2><p>The TSC Act governs the employment, discipline, and career management of teachers. Key provisions include the right to appeal disciplinary decisions and the right to representation during disciplinary proceedings.</p>', 'rights', TRUE, TRUE),
('How to Report Workplace Issues - Step by Step Guide', 'reporting-workplace-issues-guide', '<h2>When to Report</h2><p>You should report workplace issues when you experience or witness unfair treatment, harassment, unsafe working conditions, discrimination, or any violation of your employment rights.</p><h2>Internal Reporting Process</h2><p><strong>Step 1:</strong> Document the incident in writing with dates, times, witnesses, and description of events.</p><p><strong>Step 2:</strong> Report to your immediate supervisor or head of institution if appropriate.</p><p><strong>Step 3:</strong> If unresolved, escalate to the Sub-County Director of Education.</p><h2>Reporting to KUPPET</h2><p>Contact the KUPPET Migori Branch office with your documentation. Our advocacy team will review your case and advise on the best course of action, including whether to pursue the matter through the Labour Relations Court.</p><h2>Labour Relations Court</h2><p>For serious violations, cases may be filed with the Employment and Labour Relations Court (ELRC). KUPPET provides legal support to members pursuing cases at the ELRC.</p>', 'legal', TRUE, TRUE),
('Understanding Your Collective Bargaining Agreement (CBA)', 'understanding-cba-teachers', '<h2>What is a CBA?</h2><p>A Collective Bargaining Agreement is a written agreement negotiated between KUPPET (representing teachers) and the Teachers Service Commission (TSC). It governs the terms and conditions of employment for all KUPPET members.</p><h2>Current CBA Key Provisions</h2><ul><li>Salary scales and progression</li><li>Housing allowance rates</li><li>Commuter allowance</li><li>Medical coverage</li><li>Professional development leave</li><li>Promotion criteria</li></ul><h2>Your Rights Under the CBA</h2><p>Every KUPPET member is entitled to the full benefits outlined in the current CBA. If you believe your entitlements are not being honored, contact the branch office immediately.</p>', 'labour', FALSE, TRUE);

-- Default SMS templates
INSERT IGNORE INTO sms_templates (name, body, category, created_by) VALUES
('Registration Approved', 'Dear {{member_name}}, your KUPPET Migori membership application has been approved. Your member number is {{member_number}}. Welcome to the union! - KUPPET Migori', 'general', 1),
('Registration Rejected', 'Dear {{member_name}}, your KUPPET Migori membership application could not be approved at this time. Reason: {{reason}}. Please visit our office for assistance. - KUPPET Migori', 'general', 1),
('BBF Claim Submitted', 'Dear {{member_name}}, your BBF claim {{claim_number}} has been received and is under processing. You will be notified of updates. - KUPPET Migori', 'bbf', 1),
('BBF Claim Approved', 'Dear {{member_name}}, your BBF claim {{claim_number}} has been APPROVED. Amount: KES {{amount}}. Payment will be processed shortly. - KUPPET Migori', 'bbf', 1),
('BBF Claim Rejected', 'Dear {{member_name}}, your BBF claim {{claim_number}} could not be approved. Reason: {{reason}}. Contact the welfare desk for guidance. - KUPPET Migori', 'bbf', 1),
('Scholarship Application Approved', 'Dear {{member_name}}, the scholarship application for {{applicant_name}} ({{scholarship_title}}) has been APPROVED. Congratulations! - KUPPET Migori', 'scholarship', 1),
('Scholarship Application Rejected', 'Dear {{member_name}}, the scholarship application for {{applicant_name}} was unsuccessful this time. Keep applying for future opportunities. - KUPPET Migori', 'scholarship', 1),
('Event Reminder', 'Dear {{member_name}}, reminder: {{event_title}} is scheduled for {{event_date}} at {{event_venue}}. Your attendance is important. - KUPPET Migori', 'general', 1);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_news_published ON news(is_published, published_at);
CREATE INDEX IF NOT EXISTS idx_news_category ON news(category);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);

CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_tsc ON members(tsc_number);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);

CREATE INDEX IF NOT EXISTS idx_bbf_member ON bbf_claims(member_id);
CREATE INDEX IF NOT EXISTS idx_bbf_status ON bbf_claims(status);
CREATE INDEX IF NOT EXISTS idx_bbf_number ON bbf_claims(claim_number);

CREATE INDEX IF NOT EXISTS idx_bbf_docs_claim ON bbf_claim_documents(claim_id);
CREATE INDEX IF NOT EXISTS idx_bbf_timeline_claim ON bbf_claim_timeline(claim_id);

CREATE INDEX IF NOT EXISTS idx_schapp_member ON scholarship_applications(member_id);
CREATE INDEX IF NOT EXISTS idx_schapp_scholarship ON scholarship_applications(scholarship_id);
CREATE INDEX IF NOT EXISTS idx_schapp_status ON scholarship_applications(status);

CREATE INDEX IF NOT EXISTS idx_notifications_member ON notifications(member_id, is_read);

CREATE INDEX IF NOT EXISTS idx_sms_logs_member ON sms_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON sms_logs(status);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id, actor_type);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_login_user ON login_history(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_login_ip ON login_history(ip_address, created_at);
