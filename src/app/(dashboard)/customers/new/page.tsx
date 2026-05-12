import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CustomerForm } from "@/components/customers/customer-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function NewCustomerPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/customers");

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "ホーム", href: "/calendar" },
          { label: "得意先", href: "/customers" },
          { label: "新規登録" },
        ]}
        title="得意先登録"
      />
      <div className="px-4 md:px-6 py-6">
        <CustomerForm />
      </div>
    </>
  );
}
