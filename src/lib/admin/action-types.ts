export type AdminActionState = {
  success: boolean;
  message: string;
  redirectTo?: string;
};
export type AdminAction = (
  previous: AdminActionState,
  form: FormData,
) => Promise<AdminActionState>;
