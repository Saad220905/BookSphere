export interface MockUserProfile {
  bio?: string;
  favoriteGenres?: string[];
  readingGoal?: number;
  booksRead?: number;
  friends?: number;
  joinDate?: string;
}

export interface MockUserPost {
  id: string;
  content: string;
  createdAt: Date;
  likes: number;
  comments: number;
  bookTitle?: string;
  bookAuthor?: string;
}

export interface MockUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
}

// Static mock user data
export const createMockUser = (): MockUser => ({
  uid: 'mock-user-123',
  email: 'john.reader@example.com',
  displayName: 'John Reader',
  photoURL: 'https://ui-avatars.com/api/?name=John+Reader'
});

// Static mock profile data
export const createMockProfile = (): MockUserProfile => ({
  bio: 'Avid reader and book enthusiast. Love discovering new stories and sharing them with others. Currently exploring the world of classic literature.',
  favoriteGenres: ['Fiction', 'Mystery', 'Science Fiction', 'Classic Literature'],
  readingGoal: 50,
  booksRead: 23,
  friends: 156,
  joinDate: '2025-01-15T00:00:00.000Z'
});

// Static mock posts
const staticPosts: MockUserPost[] = [
  {
    id: 'post-1',
    content: 'Just finished reading "The Midnight Library" - what an incredible journey through possibilities! The way Matt Haig explores parallel lives is fascinating.',
    createdAt: new Date('2025-10-01T14:30:00Z'),
    likes: 45,
    comments: 12,
    bookTitle: 'The Midnight Library',
    bookAuthor: 'Matt Haig'
  },
  {
    id: 'post-2',
    content: 'Started my morning with a cup of coffee and Project Hail Mary. Andy Weir never disappoints with his scientific accuracy and engaging storytelling!',
    createdAt: new Date('2025-09-28T08:15:00Z'),
    likes: 38,
    comments: 8,
    bookTitle: 'Project Hail Mary',
    bookAuthor: 'Andy Weir'
  },
  {
    id: 'post-3',
    content: 'Book club discussion tonight was incredible! So many different perspectives on the ending.',
    createdAt: new Date('2025-09-25T20:45:00Z'),
    likes: 27,
    comments: 15
  },
  {
    id: 'post-4',
    content: 'Finally got my hands on "Tomorrow, and Tomorrow, and Tomorrow". Can\'t wait to dive into this story about friendship, love, and video games.',
    createdAt: new Date('2025-09-22T12:20:00Z'),
    likes: 52,
    comments: 6,
    bookTitle: 'Tomorrow, and Tomorrow, and Tomorrow',
    bookAuthor: 'Gabrielle Zevin'
  },
  {
    id: 'post-5',
    content: 'Reorganized my bookshelf today. There\'s something so satisfying about arranging books by genre and color! 📚✨',
    createdAt: new Date('2025-09-20T16:40:00Z'),
    likes: 63,
    comments: 18
  }
];

export const createMockPosts = (_count: number): MockUserPost[] => staticPosts;