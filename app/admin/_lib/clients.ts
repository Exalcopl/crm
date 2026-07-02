export type Client = {
  id: string;
  name: string;
  street?: string;
  postalCity?: string;
  phone?: string;
  email?: string;
  type?: "individual" | "business";
  nip?: string;
  contactPerson?: string;
};
