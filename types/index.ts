export interface Album {
  id: string;
  userId: string;
  name: string;
  coverPhotoUrl?: string;
  photoCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface Photo {
  url: string;
  name: string;
  caption: string;
  favorite: boolean;
  albumId?: string;
  shareId?: string;
}
