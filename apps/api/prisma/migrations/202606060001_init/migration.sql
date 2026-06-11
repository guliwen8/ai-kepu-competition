CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "SubmissionCategory" AS ENUM ('DRAMA', 'VIDEO', 'SCIFI_PAINT', 'CREATIVE_APP');
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'NEED_FIX', 'UNDER_REVIEW', 'REJECTED', 'APPROVED', 'IN_JUDGING', 'PUBLICIZED', 'ARCHIVED');
CREATE TYPE "AttachmentKind" AS ENUM ('VIDEO', 'IMAGE', 'SCRIPT', 'STATEMENT', 'ZIP', 'DOC', 'OTHER');
CREATE TYPE "ReviewTaskType" AS ENUM ('FORMAT', 'ANONYMITY', 'CONTENT');
CREATE TYPE "ReviewTaskStatus" AS ENUM ('PENDING', 'RUNNING', 'PASS', 'FAIL', 'NEED_MANUAL');
CREATE TYPE "JudgingAssignmentStatus" AS ENUM ('ASSIGNED', 'SUBMITTED', 'REVOKED');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "username" TEXT,
    "passwordHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JudgeProfile" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "realName" TEXT NOT NULL,
    "orgName" TEXT,
    "title" TEXT,
    "contact" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "JudgeProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "theme" TEXT,
    "submissionStart" TIMESTAMP(3),
    "submissionEnd" TIMESTAMP(3),
    "judgingStart" TIMESTAMP(3),
    "judgingEnd" TIMESTAMP(3),
    "publicStart" TIMESTAMP(3),
    "publicEnd" TIMESTAMP(3),
    "config" JSONB,
    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "competitionId" TEXT,
    "category" "SubmissionCategory" NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "blindCode" TEXT,
    "title" TEXT NOT NULL,
    "intro" TEXT,
    "aiToolsUsage" TEXT,
    "teacherName" TEXT,
    "teacherContact" TEXT,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "submittedAt" TIMESTAMP(3),
    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubmissionMember" (
    "submissionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubmissionMember_pkey" PRIMARY KEY ("submissionId","userId")
);

CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "AttachmentKind" NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "mimeType" TEXT,
    "byteSize" INTEGER NOT NULL,
    "meta" JSONB,
    "submissionId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReviewCase" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submissionId" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "ReviewCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReviewTask" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" "ReviewTaskType" NOT NULL,
    "status" "ReviewTaskStatus" NOT NULL DEFAULT 'PENDING',
    "findings" JSONB,
    CONSTRAINT "ReviewTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JudgingAssignment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submissionId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "status" "JudgingAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "submittedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    CONSTRAINT "JudgingAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JudgingScore" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "s1" INTEGER NOT NULL,
    "s2" INTEGER NOT NULL,
    "s3" INTEGER NOT NULL,
    "s4" INTEGER NOT NULL,
    "s5" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "comment" TEXT,
    "extra" JSONB,
    CONSTRAINT "JudgingScore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");
CREATE UNIQUE INDEX "JudgeProfile_userId_key" ON "JudgeProfile"("userId");
CREATE INDEX "Competition_isCurrent_idx" ON "Competition"("isCurrent");
CREATE INDEX "Team_ownerId_idx" ON "Team"("ownerId");
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");
CREATE INDEX "Submission_ownerId_idx" ON "Submission"("ownerId");
CREATE INDEX "Submission_competitionId_idx" ON "Submission"("competitionId");
CREATE INDEX "SubmissionMember_userId_idx" ON "SubmissionMember"("userId");
CREATE INDEX "Attachment_submissionId_idx" ON "Attachment"("submissionId");
CREATE INDEX "Attachment_uploaderId_idx" ON "Attachment"("uploaderId");
CREATE INDEX "ReviewCase_submissionId_idx" ON "ReviewCase"("submissionId");
CREATE INDEX "ReviewTask_caseId_idx" ON "ReviewTask"("caseId");
CREATE INDEX "JudgingAssignment_judgeId_status_idx" ON "JudgingAssignment"("judgeId", "status");
CREATE INDEX "JudgingAssignment_submissionId_status_idx" ON "JudgingAssignment"("submissionId", "status");
CREATE UNIQUE INDEX "JudgingAssignment_submissionId_judgeId_key" ON "JudgingAssignment"("submissionId", "judgeId");
CREATE UNIQUE INDEX "JudgingScore_assignmentId_key" ON "JudgingScore"("assignmentId");

ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JudgeProfile" ADD CONSTRAINT "JudgeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Team" ADD CONSTRAINT "Team_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubmissionMember" ADD CONSTRAINT "SubmissionMember_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubmissionMember" ADD CONSTRAINT "SubmissionMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewCase" ADD CONSTRAINT "ReviewCase_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewTask" ADD CONSTRAINT "ReviewTask_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ReviewCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JudgingAssignment" ADD CONSTRAINT "JudgingAssignment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JudgingAssignment" ADD CONSTRAINT "JudgingAssignment_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JudgingScore" ADD CONSTRAINT "JudgingScore_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "JudgingAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

