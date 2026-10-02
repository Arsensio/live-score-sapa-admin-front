import { api, ApiError } from "../../shared/api/client";

export type UserInfo = {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
};

export const userApi = {
  info: async (userId: string, signal?: AbortSignal): Promise<UserInfo | null> => {
    try {
      return await api<UserInfo>(`/api/users/userInfo/${encodeURIComponent(userId)}`, { signal });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
};
