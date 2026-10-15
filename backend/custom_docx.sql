-- ProDoc Database Schema Baseline
-- Synchronized with Phase 6B Security Remediation
-- Database: `custom_docx`

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- Disable foreign key checks during import
SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------

--
-- Table structure for table `accessrequests`
--

CREATE TABLE `accessrequests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `document_id` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `requested_by` int NOT NULL,
  `requested_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('pending','approved','rejected') COLLATE utf8mb4_general_ci DEFAULT 'pending',
  `resolved_by` int DEFAULT NULL,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `requested_permission_type` enum('owner','editor','reviewer','approver','viewer') COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `document_id` (`document_id`),
  KEY `requested_by` (`requested_by`),
  KEY `resolved_by` (`resolved_by`),
  CONSTRAINT `accessrequests_ibfk_1` FOREIGN KEY (`document_id`) REFERENCES `documents` (`document_id`) ON DELETE CASCADE,
  CONSTRAINT `accessrequests_ibfk_2` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `accessrequests_ibfk_3` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `attachments`
--

CREATE TABLE `attachments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `association_type` enum('template','document','temp') COLLATE utf8mb4_general_ci NOT NULL,
  `association_id` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `file_path` text COLLATE utf8mb4_general_ci NOT NULL,
  `file_type` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `file_size` int DEFAULT '0',
  `uploaded_by` int NOT NULL,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_attachments_association` (`association_type`,`association_id`)
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audittrail`
--

CREATE TABLE `audittrail` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `user_email` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `user_name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `action_type` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `resource_type` varchar(50) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'document',
  `resource_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `document_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ip_address` varchar(45) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_general_ci,
  `status` enum('success','failure','denied') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'success',
  PRIMARY KEY (`id`),
  KEY `organization_id` (`organization_id`),
  KEY `idx_audit_trail_user` (`user_id`),
  KEY `idx_audit_trail_document` (`document_id`),
  KEY `idx_audit_org_created` (`organization_id`,`created_at` DESC),
  KEY `idx_audit_action` (`organization_id`,`action_type`),
  KEY `idx_audit_resource` (`resource_type`,`resource_id`),
  CONSTRAINT `audittrail_ibfk_3` FOREIGN KEY (`document_id`) REFERENCES `documents` (`document_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_audittrail_org_safe` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_audittrail_user_safe` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `audittrail_chk_1` CHECK (json_valid(`details`))
) ENGINE=InnoDB AUTO_INCREMENT=218 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `departments`
--

CREATE TABLE `departments` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` int DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `manager` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('active','inactive') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'active',
  PRIMARY KEY (`id`),
  KEY `idx_departments_org` (`organization_id`),
  CONSTRAINT `fk_departments_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `documentpermissions`
--

CREATE TABLE `documentpermissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `document_id` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `user_id` int NOT NULL,
  `permission_type` enum('author','editor','reviewer','approver','viewer') COLLATE utf8mb4_general_ci NOT NULL,
  `assigned_by` int NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('active','inactive') COLLATE utf8mb4_general_ci DEFAULT 'active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_doc_user_perm` (`document_id`,`user_id`),
  KEY `assigned_by` (`assigned_by`),
  KEY `idx_document_permissions_document` (`document_id`),
  KEY `idx_document_permissions_user` (`user_id`),
  CONSTRAINT `documentpermissions_ibfk_1` FOREIGN KEY (`document_id`) REFERENCES `documents` (`document_id`) ON DELETE CASCADE,
  CONSTRAINT `documentpermissions_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `documentpermissions_ibfk_3` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=937 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `documentreferences`
--

CREATE TABLE `documentreferences` (
  `id` int NOT NULL AUTO_INCREMENT,
  `document_id` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `referenced_document_id` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `document_id` (`document_id`),
  KEY `referenced_document_id` (`referenced_document_id`),
  CONSTRAINT `documentreferences_ibfk_1` FOREIGN KEY (`document_id`) REFERENCES `documents` (`document_id`) ON DELETE CASCADE,
  CONSTRAINT `documentreferences_ibfk_2` FOREIGN KEY (`referenced_document_id`) REFERENCES `documents` (`document_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `documentrevisions`
--

CREATE TABLE `documentrevisions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `document_id` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `revision_number` decimal(3,1) NOT NULL,
  `content` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `elements` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` int NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  KEY `idx_document_revisions_document` (`document_id`),
  CONSTRAINT `documentrevisions_ibfk_1` FOREIGN KEY (`document_id`) REFERENCES `documents` (`document_id`) ON DELETE CASCADE,
  CONSTRAINT `documentrevisions_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `documentrevisions_chk_1` CHECK (json_valid(`content`)),
  CONSTRAINT `documentrevisions_chk_2` CHECK (json_valid(`elements`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `documents`
--

CREATE TABLE `documents` (
  `document_id` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `organization_id` int NOT NULL,
  `template_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `title` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `content` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `structured_data` longtext COLLATE utf8mb4_general_ci,
  `elements` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `current_revision` decimal(3,1) DEFAULT '1.0',
  `version` int NOT NULL DEFAULT '1',
  `created_by` int NOT NULL,
  `folder_id` int DEFAULT NULL,
  `approvers` text COLLATE utf8mb4_general_ci,
  `impact` text COLLATE utf8mb4_general_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status` enum('draft','pending_review','pending_approval','reviewed','approved','published','revised','pending_revision','archived','disabled') COLLATE utf8mb4_general_ci DEFAULT 'draft',
  `revision_parent_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `cover_page_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `required_approvers` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `notes` text COLLATE utf8mb4_general_ci,
  `progress_value` int DEFAULT '0',
  PRIMARY KEY (`document_id`),
  KEY `idx_documents_organization` (`organization_id`),
  KEY `idx_documents_template` (`template_id`),
  KEY `idx_documents_created_by` (`created_by`),
  KEY `folder_id` (`folder_id`),
  KEY `idx_revision_parent_id` (`revision_parent_id`),
  CONSTRAINT `documents_ibfk_1` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `documents_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_documents_revision_parent` FOREIGN KEY (`revision_parent_id`) REFERENCES `documents` (`document_id`) ON DELETE CASCADE,
  CONSTRAINT `documents_chk_1` CHECK (json_valid(`content`)),
  CONSTRAINT `documents_chk_2` CHECK (json_valid(`elements`)),
  CONSTRAINT `documents_chk_3` CHECK (json_valid(`cover_page_data`)),
  CONSTRAINT `documents_chk_4` CHECK (json_valid(`required_approvers`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `editor_references`
--

CREATE TABLE `editor_references` (
  `id` int NOT NULL AUTO_INCREMENT,
  `association_type` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `association_id` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `ref_index` int NOT NULL,
  `ref_text` text COLLATE utf8mb4_general_ci NOT NULL,
  `ref_anchor` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `created_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `editor_references_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `eventdocuments`
--

CREATE TABLE `eventdocuments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `document_id` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `event_id` (`event_id`),
  KEY `document_id` (`document_id`),
  CONSTRAINT `eventdocuments_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `eventdocuments_ibfk_2` FOREIGN KEY (`document_id`) REFERENCES `documents` (`document_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `eventparticipants`
--

CREATE TABLE `eventparticipants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `user_id` int NOT NULL,
  `status` enum('invited','accepted','declined') COLLATE utf8mb4_general_ci DEFAULT 'invited',
  PRIMARY KEY (`id`),
  KEY `event_id` (`event_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `eventparticipants_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `eventparticipants_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `events`
--

CREATE TABLE `events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `start_time` datetime NOT NULL,
  `end_time` datetime NOT NULL,
  `created_by` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('scheduled','canceled','completed') COLLATE utf8mb4_general_ci DEFAULT 'scheduled',
  PRIMARY KEY (`id`),
  KEY `organization_id` (`organization_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `events_ibfk_1` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `events_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `invited_users`
--

CREATE TABLE `invited_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `message` text COLLATE utf8mb4_general_ci,
  `password_hash` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `first_name` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `last_name` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `department` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `role` enum('admin','author','project_manager','reviewer','approver','viewer') COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('invited','pending') COLLATE utf8mb4_general_ci DEFAULT 'invited',
  `site` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_org_email_invite` (`organization_id`,`email`),
  KEY `idx_invited_users_org` (`organization_id`),
  CONSTRAINT `fk_invited_users_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `noterecipients`
--

CREATE TABLE `noterecipients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `note_id` int NOT NULL,
  `recipient_id` int NOT NULL,
  `read_at` timestamp NULL DEFAULT NULL,
  `status` enum('delivered','read') COLLATE utf8mb4_general_ci DEFAULT 'delivered',
  PRIMARY KEY (`id`),
  KEY `note_id` (`note_id`),
  KEY `recipient_id` (`recipient_id`),
  CONSTRAINT `noterecipients_ibfk_1` FOREIGN KEY (`note_id`) REFERENCES `notes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `noterecipients_ibfk_2` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notes`
--

CREATE TABLE `notes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `document_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `content` text COLLATE utf8mb4_general_ci NOT NULL,
  `is_private` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `document_id` (`document_id`),
  CONSTRAINT `notes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notes_ibfk_2` FOREIGN KEY (`document_id`) REFERENCES `documents` (`document_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `organizationfolders`
--

CREATE TABLE `organizationfolders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL,
  `folder_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `folder_path` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `class` enum('document','template') COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_orgfolders_org` (`organization_id`),
  CONSTRAINT `fk_orgfolders_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `organizations`
--

CREATE TABLE `organizations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `settings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  PRIMARY KEY (`id`),
  CONSTRAINT `organizations_chk_1` CHECK (json_valid(`settings`))
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `refresh_tokens`
--

CREATE TABLE `refresh_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `token_hash` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `revoked_at` timestamp NULL DEFAULT NULL,
  `replaced_by_hash` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_refresh_token_hash` (`token_hash`),
  CONSTRAINT `refresh_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1122 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `reviewassignments`
--

CREATE TABLE `reviewassignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `review_stage_id` int NOT NULL,
  `user_id` int NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  `status` enum('pending','completed','rejected') COLLATE utf8mb4_general_ci DEFAULT 'pending',
  `is_mandatory` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `review_stage_id` (`review_stage_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `reviewassignments_ibfk_1` FOREIGN KEY (`review_stage_id`) REFERENCES `reviewstages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reviewassignments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `reviewstages`
--

CREATE TABLE `reviewstages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `document_id` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `stage_order` int NOT NULL,
  `stage_type` enum('peer_review','team_review','approval') COLLATE utf8mb4_general_ci NOT NULL,
  `is_mandatory` tinyint(1) DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `document_id` (`document_id`),
  CONSTRAINT `reviewstages_ibfk_1` FOREIGN KEY (`document_id`) REFERENCES `documents` (`document_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sites`
--

CREATE TABLE `sites` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` int DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('active','inactive') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `org_site_name` (`organization_id`,`name`),
  CONSTRAINT `fk_sites_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `task_comments`
--

CREATE TABLE `task_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `user_id` int NOT NULL,
  `message` text NOT NULL,
  `parent_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `task_id` (`task_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `task_comments_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `task_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `taskassignments`
--

CREATE TABLE `taskassignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `assigned_to` int NOT NULL,
  `assigned_by` int NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  `status` enum('pending','in_progress','completed') COLLATE utf8mb4_general_ci DEFAULT 'pending',
  PRIMARY KEY (`id`),
  KEY `task_id` (`task_id`),
  KEY `assigned_to` (`assigned_to`),
  KEY `assigned_by` (`assigned_by`),
  CONSTRAINT `taskassignments_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `taskassignments_ibfk_2` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `taskassignments_ibfk_3` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=80 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tasks`
--

CREATE TABLE `tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL,
  `document_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `title` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `due_date` date DEFAULT NULL,
  `priority` enum('low','medium','high') COLLATE utf8mb4_general_ci DEFAULT 'medium',
  `created_by` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('not_started','in_progress','completed') COLLATE utf8mb4_general_ci DEFAULT 'not_started',
  PRIMARY KEY (`id`),
  KEY `organization_id` (`organization_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `tasks_ibfk_1` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tasks_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=63 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `template_categories`
--

CREATE TABLE `template_categories` (
  `category_id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL,
  `category_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `category_prefix` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `folder_path` varchar(512) COLLATE utf8mb4_general_ci NOT NULL,
  `parent_category_id` int DEFAULT NULL,
  PRIMARY KEY (`category_id`),
  KEY `parent_category_id` (`parent_category_id`),
  KEY `idx_template_categories_org` (`organization_id`),
  CONSTRAINT `fk_tempcat_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `template_categories_ibfk_1` FOREIGN KEY (`parent_category_id`) REFERENCES `template_categories` (`category_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `templates`
--

CREATE TABLE `templates` (
  `id` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `organization_id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Untitled Template',
  `description` text COLLATE utf8mb4_general_ci,
  `logo` longtext COLLATE utf8mb4_general_ci,
  `header_text` text COLLATE utf8mb4_general_ci,
  `footer_text` text COLLATE utf8mb4_general_ci,
  `content` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `template_structure` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `required_approvers` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `impact` longtext COLLATE utf8mb4_general_ci,
  `notes` text COLLATE utf8mb4_general_ci,
  `template_approvers` longtext COLLATE utf8mb4_general_ci,
  `comments` longtext COLLATE utf8mb4_general_ci,
  `created_by` int NOT NULL,
  `category_id` int DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status` enum('draft','pending_review','reviewed','pending_approval','approved','published','disabled','pending_revision','revised','archived','rejected') COLLATE utf8mb4_general_ci DEFAULT 'draft',
  `revision_parent_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ai_change_summary` longtext COLLATE utf8mb4_general_ci,
  `custom_document_approvers` longtext COLLATE utf8mb4_general_ci,
  `progress_value` int DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `organization_id` (`organization_id`),
  KEY `created_by` (`created_by`),
  KEY `revision_parent_id` (`revision_parent_id`),
  CONSTRAINT `templates_ibfk_1` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `templates_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `templates_ibfk_3` FOREIGN KEY (`revision_parent_id`) REFERENCES `templates` (`id`) ON DELETE CASCADE,
  CONSTRAINT `templates_chk_1` CHECK (json_valid(`content`)),
  CONSTRAINT `templates_chk_2` CHECK (json_valid(`required_approvers`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_pins`
--

CREATE TABLE `user_pins` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `item_type` varchar(32) NOT NULL,
  `item_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_item` (`user_id`,`item_type`,`item_id`),
  CONSTRAINT `user_pins_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `first_name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `last_name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `department` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `role` enum('admin','author','project_manager','reviewer','approver','viewer') COLLATE utf8mb4_general_ci DEFAULT NULL,
  `template_approver` enum('yes','no') COLLATE utf8mb4_general_ci DEFAULT 'no',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_login` timestamp NULL DEFAULT NULL,
  `status` enum('active','deactivated','inactive') COLLATE utf8mb4_general_ci DEFAULT 'active',
  `site` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `token_version` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_users_organization` (`organization_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=78 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
