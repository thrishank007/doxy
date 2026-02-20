import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

// App Router patterns — these should be clean for Next.js 14
export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <div>
      <button onClick={() => router.push("/about")}>About</button>
      <span>{searchParams.get("q")}</span>
    </div>
  );
}
