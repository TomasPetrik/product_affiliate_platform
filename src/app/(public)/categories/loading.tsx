import { Skeleton } from "@/components/ui/skeleton";
import { Container } from "@/components/public/container";

export default function CategoriesLoading() {
  return (
    <Container className="py-10 sm:py-14">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="mt-2 h-4 w-56" />

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="aspect-[4/3] min-h-[14rem] w-full rounded-[16px]" />
        ))}
      </div>
    </Container>
  );
}
