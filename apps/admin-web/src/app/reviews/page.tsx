import { Suspense } from 'react';
import ReviewsClient from './reviews-client';

export default function ReviewsPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen bg-zinc-50 p-6 text-sm text-zinc-600">加载中...</div>}
    >
      <ReviewsClient />
    </Suspense>
  );
}
