"use client"

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SignInButton, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const DEFAULT_REDIRECT = "/";
const DEPARTMENT_ROUTES: Record<string, string> = {
  ADMIN: "/crm/admin/dashboard",
  JR_CRM: "/crm/jr/dashboard",
  JR_ARCHITECT: "/crm/jr-architecture/dashboard",
  SR_CRM: "/crm/sr/dashboard",
  VISIT_TEAM: "/visit-team/visit-dashboard",
};

type Department = {
  id: string;
  name: string;
  description?: string | null;
};

type MeResponse = {
  id: string;
  fullName?: string;
  isActive?: boolean;
  needsOnboarding?: boolean;
  canSelfAssignDepartment?: boolean;
  requiresAdminApproval?: boolean;
  bootstrapMode?: boolean;
  isRejected?: boolean;
  accountStatus?: "ACTIVE" | "PENDING_APPROVAL" | "REJECTED";
  userDepartments?: Array<{ department: { id: string; name: string } }>;
  clerkDepartment?: { id: string | null; name: string | null };
};

type DepartmentCreateResponse = {
  success?: boolean;
  data?: Department;
  error?: string;
  message?: string;
};

export default function OnboardingPage() {
  // console.log('[OnboardingPage] Component mounted');
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  // console.log('[OnboardingPage] Clerk status:', { isLoaded, isSignedIn, userId: user?.id, userEmail: user?.emailAddresses[0]?.emailAddress });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [requiresAdminApproval, setRequiresAdminApproval] = useState(false);
  const [isRejected, setIsRejected] = useState(false);
  const [bootstrapMode, setBootstrapMode] = useState(false);
  const [canCreateDepartment, setCanCreateDepartment] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [newDepartmentDescription, setNewDepartmentDescription] = useState("");
  const [creatingDepartment, setCreatingDepartment] = useState(false);
  const [departmentNotice, setDepartmentNotice] = useState<string | null>(null);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  
  // console.log('[OnboardingPage] State:', { loading, saving, departmentsCount: departments.length, selectedDepartmentId });

  const selectedDepartment = useMemo(
    () => {
      const selected = departments.find((dept) => dept.id === selectedDepartmentId) ?? null;
      // console.log('[OnboardingPage] selectedDepartment computed:', { selectedDepartmentId, found: !!selected, department: selected });
      return selected;
    },
    [departments, selectedDepartmentId],
  );

  const resolveRedirect = (departmentName?: string | null) => {
    const redirect = !departmentName ? DEFAULT_REDIRECT : DEPARTMENT_ROUTES[departmentName] ?? DEFAULT_REDIRECT;
    // console.log('[OnboardingPage] resolveRedirect:', { departmentName, redirect });
    return redirect;
  };

  const loadDepartments = useCallback(async () => {
    setDepartmentsLoading(true);
    try {
      const departmentsRes = await fetch("/api/department", { cache: "no-store" });
      if (!departmentsRes.ok) {
        throw new Error("Unable to load departments.");
      }

      const payload = await departmentsRes.json();
      if (!payload?.success || !Array.isArray(payload.data)) {
        throw new Error("Unable to load departments.");
      }

      setDepartments(payload.data as Department[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setDepartmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    // console.log('[OnboardingPage] useEffect triggered:', { isLoaded, isSignedIn });
    
    if (!isLoaded) {
      // console.log('[OnboardingPage] Clerk not loaded yet, returning');
      return;
    }

    if (!isSignedIn) {
      // console.log('[OnboardingPage] User not signed in, setting loading to false');
      setLoading(false);
      return;
    }

    const load = async () => {
      // console.log('[OnboardingPage] Starting data load');
      setError(null);
      try {
        // console.log('[OnboardingPage] Fetching /api/me');
        const meRes = await fetch("/api/me", { cache: "no-store" });
        // console.log('[OnboardingPage] /api/me response:', { status: meRes.status, ok: meRes.ok });
        
        if (!meRes.ok) {
          console.error('[OnboardingPage] /api/me failed with status', meRes.status);
          throw new Error("Unable to load your profile.");
        }

        const me = (await meRes.json()) as MeResponse;
        const existingDepartmentName =
          me.userDepartments?.[0]?.department?.name ?? me.clerkDepartment?.name ?? null;
        setRequiresAdminApproval(Boolean(me.requiresAdminApproval));
        setIsRejected(Boolean(me.isRejected));
        setBootstrapMode(Boolean(me.bootstrapMode));
        setCanCreateDepartment(Boolean(me.canSelfAssignDepartment || me.bootstrapMode));
        // console.log('[OnboardingPage] existingDepartmentName:', existingDepartmentName);

        if (me.needsOnboarding === false && existingDepartmentName) {
          // console.log('[OnboardingPage] User already has department assigned, redirecting to:', resolveRedirect(existingDepartmentName));
          router.replace(resolveRedirect(existingDepartmentName));
          return;
        }

        if (me.requiresAdminApproval || me.isRejected) {
          setDepartments([]);
          return;
        }

        void loadDepartments();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong.";
        console.error('[OnboardingPage] Error during load:', message, err);
        setError(message);
      } finally {
        setLoading(false);
        // console.log('[OnboardingPage] Load complete, setting loading to false');
      }
    };

    load();
  }, [isLoaded, isSignedIn, loadDepartments, router]);

  const handleSubmit = async () => {
    // console.log('[OnboardingPage] handleSubmit called:', { selectedDepartmentId });
    
    if (!selectedDepartmentId) {
      console.error('[OnboardingPage] No department selected');
      setError("Please select a department to continue.");
      return;
    }

    if (requiresAdminApproval) {
      setError("Account setup requires admin approval. Please contact an administrator.");
      return;
    }
    if (isRejected) {
      setError("Your account request was rejected. Please contact admin.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const requestBody = { departmentId: selectedDepartmentId };
      // console.log('[OnboardingPage] Sending PATCH /api/me with body:', requestBody);
      
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      // console.log('[OnboardingPage] PATCH /api/me response:', { status: res.status, ok: res.ok });

      if (!res.ok) {
        let payload: { error?: string; message?: string } = {};
        const contentType = res.headers.get('content-type');
        // console.log('[OnboardingPage] Response content-type:', contentType);
        
        try {
          const text = await res.text();
          // console.log('[OnboardingPage] Raw response body:', text);
          if (text && contentType?.includes('application/json')) {
            const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
            payload = {
              error: typeof parsed.error === "string" ? parsed.error : undefined,
              message: typeof parsed.message === "string" ? parsed.message : undefined,
            };
          }
        } catch (parseErr) {
          console.error('[OnboardingPage] Failed to parse response:', parseErr);
        }
        
        const message = payload?.error || payload?.message || "Unable to save your department.";
        console.error('[OnboardingPage] PATCH /api/me failed:', { status: res.status, error: message, payload });
        throw new Error(message);
      }

      await res.json();
      const redirectPath = resolveRedirect(selectedDepartment?.name ?? null);
      // console.log('[OnboardingPage] Redirecting to:', redirectPath);
      router.replace(redirectPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      console.error('[OnboardingPage] handleSubmit error:', message, err);
      setError(message);
    } finally {
      setSaving(false);
      // console.log('[OnboardingPage] handleSubmit complete');
    }
  };

  const handleCreateDepartment = async () => {
    const normalizedName = newDepartmentName.trim();
    const normalizedDescription = newDepartmentDescription.trim();

    if (!normalizedName) {
      setError("Department name is required.");
      return;
    }

    setCreatingDepartment(true);
    setError(null);
    setDepartmentNotice(null);

    try {
      const res = await fetch("/api/department", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: normalizedName,
          description: normalizedDescription.length > 0 ? normalizedDescription : null,
        }),
      });

      const payload = (await res.json()) as DepartmentCreateResponse;
      if (!res.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || payload.message || "Unable to create department.");
      }
      const createdDepartment: Department = payload.data;

      setDepartments((prev) => {
        const next = [...prev, createdDepartment];
        next.sort((a, b) => a.name.localeCompare(b.name));
        return next;
      });
      setSelectedDepartmentId(createdDepartment.id);
      setNewDepartmentName("");
      setNewDepartmentDescription("");
      setDepartmentNotice(`Department "${createdDepartment.name}" created and selected.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create department.";
      setError(message);
    } finally {
      setCreatingDepartment(false);
    }
  };

  if (!isLoaded || loading) {
    // console.log('[OnboardingPage] Rendering loading state:', { isLoaded, loading });
    return (
      <main className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-muted/30 px-6 py-12">
        <Card className="w-full max-w-xl border-border">
          <CardHeader>
            <CardTitle>Setting up your workspace</CardTitle>
            <CardDescription>Loading your profile...</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (!isSignedIn) {
    // console.log('[OnboardingPage] Rendering not signed in state');
    return (
      <main className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-muted/30 px-6 py-12">
        <Card className="w-full max-w-xl border-border">
          <CardHeader>
            <CardTitle>Sign in to continue</CardTitle>
            <CardDescription>Your onboarding is waiting for you.</CardDescription>
          </CardHeader>
          <CardFooter>
            <SignInButton>
              <Button className="w-full">Sign in</Button>
            </SignInButton>
          </CardFooter>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-muted/30 px-6 py-12">
      <Card className="w-full max-w-xl border-border">
        <CardHeader>
          <CardTitle>Welcome{user?.firstName ? `, ${user.firstName}` : ""}</CardTitle>
          <CardDescription>
            {requiresAdminApproval
              ? "Your account is created. Please wait for admin approval to continue."
              : isRejected
                ? "Access denied by admin. Please contact admin to request access."
              : "Choose the department you work with so we can personalize your workspace."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {requiresAdminApproval ? (
            <p className="text-sm text-muted-foreground">
              Ask an administrator to assign your role and department. You can sign in now, but
              access will be enabled only after approval.
            </p>
          ) : isRejected ? (
            <p className="text-sm text-destructive">
              Your account is banned. Contact admin for approval.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select 
                  value={selectedDepartmentId} 
                  disabled={departmentsLoading}
                  onValueChange={(value) => {
                    // console.log('[OnboardingPage] Department selected:', { value });
                    setSelectedDepartmentId(value);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select your department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedDepartment?.description ? (
                  <p className="text-xs text-muted-foreground">{selectedDepartment.description}</p>
                ) : null}
                {departmentsLoading ? (
                  <p className="text-xs text-muted-foreground">Loading departments...</p>
                ) : null}
              </div>

              {!departmentsLoading && departments.length === 0 ? (
                canCreateDepartment ? (
                  <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
                    <p className="text-sm text-muted-foreground">
                      No departments found. Create your first department to continue.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="new-department-name">Department name</Label>
                      <Input
                        id="new-department-name"
                        value={newDepartmentName}
                        onChange={(event) => setNewDepartmentName(event.target.value)}
                        placeholder="e.g. JR_CRM"
                        disabled={creatingDepartment}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-department-description">Description (optional)</Label>
                      <Input
                        id="new-department-description"
                        value={newDepartmentDescription}
                        onChange={(event) => setNewDepartmentDescription(event.target.value)}
                        placeholder="What this department handles"
                        disabled={creatingDepartment}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCreateDepartment}
                      disabled={creatingDepartment}
                    >
                      {creatingDepartment ? "Creating..." : "Create Department"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No departments are available yet. Please contact an administrator.
                  </p>
                )
              ) : null}
              {bootstrapMode ? (
                <p className="text-xs text-muted-foreground">
                  First account setup is enabled. Once saved, this account also gets ADMIN access
                  so you can approve future signups.
                </p>
              ) : null}
              {departmentNotice ? (
                <p className="text-sm text-emerald-700">{departmentNotice}</p>
              ) : null}
            </>
          )}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          {requiresAdminApproval || isRejected ? (
            <p className="text-xs text-muted-foreground text-center w-full">
              {isRejected ? "Access blocked. Contact admin." : "Approval pending. Please contact admin."}
            </p>
          ) : (
            <>
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={saving || departmentsLoading || !selectedDepartmentId || departments.length === 0}
              >
                {saving ? "Saving..." : "Continue"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                You can update your department later from settings.
              </p>
            </>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}
