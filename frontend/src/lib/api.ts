const API_BASE_URL = 'http://localhost:4000/api/v1';

export interface AuthResponse {
  token: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
  };
}

export interface SignUpData {
  fullName: string;
  email: string;
  password: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface VideoUploadResponse {
  videoId: string;
  message?: string;
}

export interface QueryResponse {
  response: string;
  videoId: string;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Network error' }));
    throw new ApiError(response.status, errorData.message || 'Something went wrong');
  }
  return response.json();
};

export const authApi = {
  signUp: async (data: SignUpData): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  signIn: async (data: SignInData): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },
};

export const videoApi = {
  upload: async (file: File): Promise<VideoUploadResponse> => {
    const formData = new FormData();
    formData.append('video', file);

    const response = await fetch(`${API_BASE_URL}/video/upload`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
      },
      body: formData,
    });
    return handleResponse(response);
  },

  query: async (videoId: string, query: string): Promise<QueryResponse> => {
    const response = await fetch(`${API_BASE_URL}/video/query/ask/${videoId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ query }),
    });
    return handleResponse(response);
  },
};

export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('token');
};

export const logout = (): void => {
  localStorage.removeItem('token');
};