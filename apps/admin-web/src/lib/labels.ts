export function labelCategory(v: string) {
  if (v === "VIDEO") return "科普视频";
  if (v === "DRAMA") return "科普剧";
  if (v === "SCIFI_PAINT") return "科幻画";
  if (v === "CREATIVE_APP") return "创意作品";
  return v;
}

export function labelSubmissionStatus(v: string) {
  if (v === "NEED_FIX") return "需修改";
  if (v === "UNDER_REVIEW") return "审核中";
  if (v === "DRAFT") return "草稿";
  if (v === "SUBMITTED") return "已提交";
  if (v === "REJECTED") return "已拒绝";
  if (v === "APPROVED") return "已通过";
  if (v === "IN_JUDGING") return "评审中";
  if (v === "PUBLICIZED") return "公示中";
  if (v === "ARCHIVED") return "已归档";
  return v;
}

export function labelReviewSummary(v: string) {
  if (v === "PASS") return "通过";
  if (v === "FAIL") return "不通过";
  if (v === "NEED_MANUAL") return "待人工复核";
  return v;
}

export function labelReviewTaskType(v: string) {
  if (v === "FORMAT") return "格式";
  if (v === "ANONYMITY") return "匿名";
  if (v === "CONTENT") return "内容";
  return v;
}

export function labelReviewTaskStatus(v: string) {
  if (v === "PENDING") return "待执行";
  if (v === "RUNNING") return "执行中";
  if (v === "PASS") return "通过";
  if (v === "FAIL") return "不通过";
  if (v === "NEED_MANUAL") return "待人工";
  return v;
}

export function labelRole(v: string) {
  if (v === "admin") return "管理员";
  if (v === "participant") return "参赛者";
  if (v === "judge") return "评委";
  return v;
}

export function labelJudgingAssignmentStatus(v: string) {
  if (v === "ASSIGNED") return "已分配";
  if (v === "SUBMITTED") return "已提交";
  if (v === "REVOKED") return "已撤销";
  return v;
}

export function labelUserStatus(v: string) {
  if (v === "active") return "正常";
  if (v === "disabled") return "已禁用";
  return v;
}
