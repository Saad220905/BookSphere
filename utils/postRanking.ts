import { getUserProfile, UserProfile } from './userProfile';

export interface FeedPost {
  id: string;
  content: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL?: string;
  bookTitle?: string;
  bookAuthor?: string;
  genre?: string;
  likes: number;
  comments: number;
  createdAt: any;
  likedBy: string[];
  score?: number;
}

export interface UserSimilarity {
  userId: string;
  similarity: number;
  commonGenres: string[];
}

/**
 * Calculate genre similarity between two users using Jaccard coefficient
 */
export function calculateGenreSimilarity(
  userGenres: string[] = [],
  otherGenres: string[] = []
): number {
  if (userGenres.length === 0 || otherGenres.length === 0) {
    return 0;
  }

  const userGenresLower = userGenres.map(g => g.toLowerCase().trim());
  const otherGenresLower = otherGenres.map(g => g.toLowerCase().trim());

  const intersection = userGenresLower.filter(g => otherGenresLower.includes(g));
  const union = [...new Set([...userGenresLower, ...otherGenresLower])];

  // Jaccard similarity coefficient
  return union.length > 0 ? intersection.length / union.length : 0;
}

/**
 * Extract genre from book title/author or content using keyword matching
 */
export function extractGenreFromPost(post: FeedPost): string | null {
  if (post.genre) {
    return post.genre;
  }

  const content = (post.content + ' ' + (post.bookTitle || '') + ' ' + (post.bookAuthor || '')).toLowerCase();
  
  const genreKeywords: Record<string, string[]> = {
    'Fantasy': ['fantasy', 'magic', 'wizard', 'dragon', 'quest', 'kingdom', 'enchanted'],
    'Science Fiction': ['sci-fi', 'science fiction', 'space', 'future', 'robot', 'alien', 'dystopian'],
    'Mystery': ['mystery', 'detective', 'crime', 'murder', 'investigation', 'thriller'],
    'Romance': ['romance', 'love', 'romantic', 'relationship', 'dating', 'wedding'],
    'Thriller': ['thriller', 'suspense', 'action', 'adventure', 'danger', 'chase'],
    'Horror': ['horror', 'scary', 'frightening', 'terror', 'ghost', 'zombie', 'haunted'],
    'Historical Fiction': ['historical', 'history', 'ancient', 'war', 'medieval', 'victorian'],
    'Non-Fiction': ['non-fiction', 'biography', 'memoir', 'history', 'true story', 'autobiography'],
    'Young Adult': ['young adult', 'ya', 'teen', 'coming of age', 'high school'],
    'Literary Fiction': ['literary', 'classic', 'award-winning', 'bestseller'],
  };

  for (const [genre, keywords] of Object.entries(genreKeywords)) {
    if (keywords.some(keyword => content.includes(keyword))) {
      return genre;
    }
  }

  return null;
}

// Cache for user profiles to avoid repeated fetches
const profileCache = new Map<string, { profile: UserProfile | null; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getCachedUserProfile(userId: string): Promise<UserProfile | null> {
  const cached = profileCache.get(userId);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.profile;
  }
  
  try {
    const profile = await getUserProfile(userId);
    profileCache.set(userId, { profile, timestamp: now });
    return profile;
  } catch (error) {
    console.error(`Error fetching profile for ${userId}:`, error);
    profileCache.set(userId, { profile: null, timestamp: now });
    return null;
  }
}

/**
 * Calculate user similarity scores for all users who made posts
 */
export async function calculateUserSimilarities(
  currentUserProfile: UserProfile | null,
  postUserIds: string[]
): Promise<Map<string, UserSimilarity>> {
  const similarities = new Map<string, UserSimilarity>();

  if (!currentUserProfile?.favoriteGenres || currentUserProfile.favoriteGenres.length === 0) {
    return similarities;
  }

  const uniqueUserIds = [...new Set(postUserIds)];
  const userGenres = currentUserProfile.favoriteGenres || [];

  // Fetch all user profiles in parallel (with caching and error handling)
  const userProfilePromises = uniqueUserIds.map(userId => getCachedUserProfile(userId));
  const userProfiles = await Promise.all(userProfilePromises);

  for (let i = 0; i < uniqueUserIds.length; i++) {
    const userId = uniqueUserIds[i];
    const otherProfile = userProfiles[i];

    if (otherProfile?.favoriteGenres && otherProfile.favoriteGenres.length > 0) {
      const similarity = calculateGenreSimilarity(
        userGenres,
        otherProfile.favoriteGenres
      );

      if (similarity > 0) {
        const commonGenres = userGenres.filter(g =>
          otherProfile.favoriteGenres?.some(og => 
            g.toLowerCase().trim() === og.toLowerCase().trim()
          )
        );

        similarities.set(userId, {
          userId,
          similarity,
          commonGenres,
        });
      }
    }
  }

  return similarities;
}

/**
 * Calculate engagement score for a post
 */
export function calculateEngagementScore(post: FeedPost): number {
  // Weighted engagement: likes * 2 + comments * 3
  // Comments indicate deeper engagement
  return post.likes * 2 + post.comments * 3;
}

/**
 * Calculate recency score (higher for newer posts)
 */
export function calculateRecencyScore(createdAt: any): number {
  if (!createdAt) return 0;

  let postDate: Date;
  try {
    if (createdAt instanceof Date) {
      postDate = createdAt;
    } else if (typeof createdAt?.toDate === 'function') {
      postDate = createdAt.toDate();
    } else if (typeof createdAt === 'number') {
      postDate = new Date(createdAt);
    } else {
      return 0;
    }
  } catch {
    return 0;
  }

  const now = new Date();
  const hoursSincePost = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60);

  // Exponential decay: newer posts get higher scores
  if (hoursSincePost < 1) return 10;
  if (hoursSincePost < 6) return 9;
  if (hoursSincePost < 24) return 8;
  if (hoursSincePost < 48) return 6;
  if (hoursSincePost < 168) return 4; // 1 week....
  if (hoursSincePost < 720) return 2;
  return 1;
}

/**
 * Rank posts using multiple factors
 */
export async function rankPosts(
  posts: FeedPost[],
  currentUserProfile: UserProfile | null,
  friendIds: string[] = []
): Promise<FeedPost[]> {
  if (posts.length === 0 || !currentUserProfile) {
    return posts;
  }

  // Calculate user similarities
  const postUserIds = posts.map(p => p.userId);
  const userSimilarities = await calculateUserSimilarities(
    currentUserProfile,
    postUserIds
  );

  // Rank each post
  const rankedPosts = posts.map(post => {
    let score = 0;

    // 1. Friend boost (highest priority)
    const isFriend = friendIds.includes(post.userId);
    if (isFriend) {
      score += 50;
    }

    // 2. User similarity score
    const similarity = userSimilarities.get(post.userId);
    if (similarity && similarity.similarity > 0) {
      score += similarity.similarity * 30;
    }

    // 3. Genre match
    const postGenre = extractGenreFromPost(post);
    if (postGenre && currentUserProfile.favoriteGenres) {
      const userGenres = currentUserProfile.favoriteGenres.map(g => g.toLowerCase().trim());
      if (userGenres.includes(postGenre.toLowerCase())) {
        score += 20;
      }
    }

    // 4. Engagement score (normalized, capped at 15)
    const engagement = calculateEngagementScore(post);
    score += Math.min(engagement / 10, 15);

    // 5. Recency score
    score += calculateRecencyScore(post.createdAt);

    // 6. Self-created posts get slight boost
    if (post.userId === currentUserProfile.uid) {
      score += 5;
    }

    return { ...post, score };
  });

  // Sort by score (descending), then by recency as tiebreaker
  return rankedPosts.sort((a, b) => {
    const scoreDiff = (b.score || 0) - (a.score || 0);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    // Tiebreaker: recency
    const aRecency = calculateRecencyScore(a.createdAt);
    const bRecency = calculateRecencyScore(b.createdAt);
    return bRecency - aRecency;
  });
}


