// Importing from next/router (Pages Router) in an App Router project
// is not an error per se, but withRouter was removed in certain contexts
import { withRouter } from "next/router";

function LegacyPage({ router }: { router: ReturnType<typeof import("next/router").useRouter> }) {
  return <div>{router.pathname}</div>;
}

export default withRouter(LegacyPage);
