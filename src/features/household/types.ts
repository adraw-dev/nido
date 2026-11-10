export type Role = 'owner' | 'member';

export type Profile = {
  id: string;
  display_name: string;
  avatar_path: string | null;
  accent: string | null;
};

export type Household = {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  created_by: string;
  created_at: string;
};

export type Membership = {
  role: Role;
  household: Household;
};

export type Member = {
  user_id: string;
  role: Role;
  joined_at: string;
  profile: Profile;
};

export type Invite = {
  code: string;
  expires_at: string;
};
