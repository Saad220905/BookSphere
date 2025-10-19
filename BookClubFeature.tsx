import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, User as FirebaseAuthUser, getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { addDoc, arrayRemove, arrayUnion, collection, CollectionReference, deleteDoc, doc, DocumentData, DocumentReference, Firestore, getDocs, getFirestore, onSnapshot, query, Query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';

// --- Icon Imports from Lucide ---
import { BookOpen, CheckCircle, ChevronLeft, CirclePlus, Clock, Hourglass, ListOrdered, Megaphone, Pencil, Search, Send, Trash2, User, Users, UserX, X } from 'lucide-react';

// ====================================================================================
// CONFIGURATION, STYLES & GLOBAL UTILITIES
// ====================================================================================

// Refined colors
const colors = {
  primary: '#1D3557',    // Dark Navy
  secondary: '#457B9D',  // Mid-Blue
  accent: '#00A3C9',     // Bright Cyan/Blue
  cardBg: '#FFFFFF',     // White
  textLight: '#FFFFFF',
  textDark: '#1D3557',
  bg: '#F8F8F8',
};

// --- Firebase Configuration Definitions ---
const appId: string = '1:883642406925:web:caba402da9cabf992d5d44'; 
const firebaseConfig = {
  apiKey: "AIzaSyC_Xk1gn8No323hV15Ub4gkvQMYpExVarc",
  authDomain: "book-club-b4ba1.firebaseapp.com",
  projectId: "book-club-b4ba1",
  storageBucket: "book-club-b4ba1.firebasestorage.app",
  messagingSenderId: "883642406925",
  appId: "1:883642406925:web:caba402da9cabf992d5d44",
  measurementId: "G-85FZJ6X42Z"
};
const initialAuthToken: string | undefined = undefined;

// --- Interface Definitions ---

interface CurrentBook {
    title: string;
    author: string;
    chapters: number | null;
}

// ClubBase uses the types as they appear in React state 
interface ClubBase {
    name: string;
    description: string;
    creatorId: string;
    createdAt: DocumentData; // Remains DocumentData as it's often serverTimestamp() on write
    members: string[];
    pendingMembers: string[];
    memberNames: { id: string; name: string }[];
    requiresApproval: boolean;
    currentBook: CurrentBook; // Simplified to always be the structured object
    announcement: string;
    announcementAuthor: string;
    announcementTimestamp: number | null; 
}

// ClubDetails adds local derived properties for the user
interface ClubDetails extends ClubBase {
    id: string;
    status: 'member' | 'pending' | 'none';
    isOwner: boolean;
}

interface ChatMessage {
    id: string;
    user: string;
    userId: string;
    text: string;
    timestamp: number; 
    clubId: string;
    chapter: number;
}

interface FirebaseState {
    auth: Auth | null;
    db: Firestore | null;
    userId: string | null;
    isReady: boolean;
}

// --- Utility Functions ---

/** Converts Firestore Timestamp to milliseconds (number) or returns null/existing number. */
const getTimestampInMs = (ts: any): number | null => {
    if (!ts) return null;
    // Check if it is a Firestore Timestamp object (must have .toDate method)
    if (typeof ts === 'object' && 'toDate' in ts && typeof ts.toDate === 'function') {
        return ts.toDate().getTime();
    }
    // Check if it's already a number (which it should be if read from state)
    if (typeof ts === 'number') {
        return ts;
    }
    return null;
};

const withRetry = async <T,>(fn: () => Promise<T>, maxRetries = 5): Promise<T> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise<void>(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("withRetry failed after maximum retries.");
};

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

// Define props for ChatBubble
interface ChatBubbleProps {
    message: ChatMessage;
    isCurrentUser: boolean;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isCurrentUser }) => (
  <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
    <div 
      className={`p-3 rounded-xl shadow-sm max-w-[80%] transition-all duration-300 ${isCurrentUser ? 'rounded-br-sm' : 'rounded-tl-sm'}`}
      style={{ 
        backgroundColor: isCurrentUser ? colors.accent : colors.cardBg, 
        color: colors.textDark,
        marginLeft: isCurrentUser ? 'auto' : '0',
        marginRight: isCurrentUser ? '0' : 'auto',
      }}
    >
      <p className="font-semibold text-xs" style={{ color: colors.secondary }}>
        {message.user}
      </p>
      <p className="text-sm break-words mt-0.5">
        {message.text}
      </p>
      <div className="flex justify-end text-xs opacity-75 mt-1">
        <Clock className="h-3 w-3 mr-1" />
        {formatTimestamp(message.timestamp)}
      </div>
    </div>
  </div>
);

// Function to delete all chat messages for a given clubId
const clearClubChat = async (db: Firestore | null, clubId: string): Promise<void> => {
    if (!db || !clubId) return;

    try {
        const chatCollectionRef = collection(db, `/artifacts/${appId}/public/data/club_chat`);
        const q: Query<DocumentData> = query(chatCollectionRef, where('clubId', '==', clubId));
        
        const snapshot = await withRetry(() => getDocs(q));

        if (snapshot.empty) return;

        const deletionPromises: Promise<void>[] = snapshot.docs.map(docSnap => 
            withRetry(() => deleteDoc(doc(db, `/artifacts/${appId}/public/data/club_chat`, docSnap.id)))
        );

        await Promise.all(deletionPromises);
    } catch (error) {
        console.error(`Error clearing chat for club ${clubId}:`, error);
        throw new Error("Failed to clear chat messages.");
    }
};

// ====================================================================================
// CLUB OWNER FEATURES & UI COMPONENTS
// ====================================================================================

// Define props for CreateClubForm
interface CreateClubFormProps {
    setView: (view: string) => void;
    setActiveClubId: (id: string | null) => void;
    firebase: FirebaseState;
    userId: string | null;
}

const CreateClubForm: React.FC<CreateClubFormProps> = ({ setView, setActiveClubId, firebase, userId }) => {
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [requiresApproval, setRequiresApproval] = useState<boolean>(false); 
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const trimmedName = name.trim();
    if (!trimmedName || !description.trim() || !firebase.db || !userId) return setError('Please complete all fields.');

    setLoading(true);
    try {
      const clubsCollectionRef = collection(firebase.db, `/artifacts/${appId}/public/data/clubs`);

      const q = query(clubsCollectionRef, where('name', '==', trimmedName));
      const snapshot = await withRetry(() => getDocs(q));

      if (!snapshot.empty) {
          setError(`A club named "${trimmedName}" already exists. Please choose a unique name.`);
          setLoading(false);
          return; 
      }

      // If name is unique, proceed with creation
      const newClub: Omit<ClubBase, 'currentBook' | 'announcementTimestamp'> & { currentBook: CurrentBook | string, announcementTimestamp: DocumentData | null } = {
        name: trimmedName,
        description: description.trim(),
        creatorId: userId,
        createdAt: serverTimestamp(),
        members: [userId],
        pendingMembers: [],
        memberNames: [{id: userId, name: `User_${userId.substring(0, 8)}`}],
        requiresApproval: requiresApproval, 
        currentBook: { title: "TBD: Set your first book!", author: "", chapters: null }, // Initialize with chapters
        announcement: '',
        announcementAuthor: '',
        announcementTimestamp: null,
      };

      const docRef = await withRetry(() => addDoc(clubsCollectionRef, newClub));
      setActiveClubId(docRef.id);
      setView('clubDetail');
    } catch (err) {
      console.error("Error creating club:", err);
      setError('Failed to create club. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 pt-10" style={{ backgroundColor: colors.cardBg, minHeight: 'calc(100vh - 4rem)' }}>
      <h2 className="text-2xl font-bold mb-4" style={{ color: colors.primary }}>Start a New Book Club</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: colors.secondary }}>Club Name</label>
          <input type="text" className="w-full p-3 rounded-lg shadow-inner focus:outline-none" style={{ backgroundColor: '#F0F0F0', border: `1px solid ${colors.secondary}` }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., The Literary Lions" disabled={loading} />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: colors.secondary }}>Description</label>
          <textarea rows={4} className="w-full p-3 rounded-lg shadow-inner focus:outline-none resize-none" style={{ backgroundColor: '#F0F0F0', border: `1px solid ${colors.secondary}` }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What kind of books do you read?" disabled={loading}></textarea>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg shadow-sm" style={{ backgroundColor: '#F0F0F0', border: `1px solid ${colors.secondary}` }}>
            <div className="flex flex-col">
                <label className="text-sm font-bold" style={{ color: colors.secondary }}>Require Membership Approval</label>
                <p className="text-xs text-gray-500 mt-0.5">{requiresApproval ? 'New members must be approved.' : 'Anyone can join instantly.'}</p>
            </div>
            <div 
                className={`relative w-14 h-8 flex items-center rounded-full p-1 cursor-pointer transition-colors ${requiresApproval ? 'bg-green-500' : 'bg-gray-400'}`}
                onClick={() => setRequiresApproval(!requiresApproval)}>
                <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform ${requiresApproval ? 'translate-x-6' : 'translate-x-0'}`}/>
            </div>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        
        <div className="flex justify-between pt-4">
          <button type="button" className="flex items-center justify-center py-3 px-6 rounded-full text-sm font-semibold transition-colors disabled:opacity-50 bg-gray-200 text-gray-700" onClick={() => setView('dashboard')} disabled={loading}><X className="h-4 w-4 mr-2" />Cancel</button>
          <button type="submit" className="flex items-center justify-center py-3 px-6 rounded-full text-sm font-semibold transition-transform hover:scale-[1.03] disabled:opacity-50" style={{ backgroundColor: colors.accent, color: colors.textLight }} disabled={loading || !name.trim() || !description.trim()}>
            {loading ? 'Creating...' : (<><CirclePlus className="h-4 w-4 mr-2" />Create Club</>)}
          </button>
        </div>
      </form>
    </div>
  );
};

// Define props for OwnerPanel
interface OwnerPanelProps {
    firebase: FirebaseState;
    clubDetails: ClubDetails;
}

// Owner component to manage pending members
const OwnerPanel: React.FC<OwnerPanelProps> = ({ firebase, clubDetails }) => {
    const [processingId, setProcessingId] = useState<string | null>(null);
    const clubDocRef: DocumentReference<DocumentData> = doc(firebase.db as Firestore, `/artifacts/${appId}/public/data/clubs`, clubDetails.id);

    // Handles approving or rejecting a member request
    const processRequest = async (pendingUserId: string, action: 'approve' | 'reject') => {
        setProcessingId(pendingUserId);
        try {
            const updates: DocumentData = { pendingMembers: arrayRemove(pendingUserId) };
            if (action === 'approve') {
                updates.members = arrayUnion(pendingUserId);
                updates.memberNames = arrayUnion({id: pendingUserId, name: `User_${pendingUserId.substring(0, 8)}`}); 
            }
            await withRetry(() => updateDoc(clubDocRef, updates));
        } catch (error) {
            console.error(`Error processing ${action} request for ${pendingUserId}:`, error);
        } finally {
            setProcessingId(null);
        }
    };

    if (!clubDetails.pendingMembers || clubDetails.pendingMembers.length === 0) return null;

    return (
        <div className="mb-6 p-4 rounded-xl shadow-lg border-2 border-dashed" style={{ backgroundColor: colors.cardBg, borderColor: colors.secondary }}>
            <h3 className="text-xl font-bold mb-3 flex items-center" style={{ color: colors.primary }}>
                <Users className="h-5 w-5 mr-2" /> Pending Approvals ({clubDetails.pendingMembers.length})
            </h3>
            <p className="text-sm mb-4" style={{ color: colors.textDark }}>Review new member requests for **{clubDetails.name}**.</p>
            <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar">
                {clubDetails.pendingMembers.map(userId => (
                    <div key={userId} className="flex items-center justify-between p-3 rounded-lg shadow-sm" style={{ backgroundColor: '#F0F8FF' }}> 
                        <p className="font-medium text-sm" style={{ color: colors.secondary }}>
                            <User className="h-4 w-4 inline mr-1" /> User_{userId.substring(0, 8)}...
                        </p>
                        <div className="flex space-x-2">
                            <button 
                                onClick={() => processRequest(userId, 'approve')} 
                                disabled={processingId === userId || !firebase.db} 
                                className="flex items-center text-xs font-semibold py-1 px-3 rounded-full transition-colors disabled:opacity-50 hover:brightness-110" 
                                style={{ backgroundColor: colors.accent, color: colors.textLight }}
                            >
                                {processingId === userId ? 'Approving...' : (<><CheckCircle className="h-4 w-4 mr-1" />Approve</>)}
                            </button>
                            <button 
                                onClick={() => processRequest(userId, 'reject')} 
                                disabled={processingId === userId || !firebase.db} 
                                className="flex items-center text-xs font-semibold py-1 px-3 rounded-full transition-colors disabled:opacity-50 hover:brightness-110" 
                                style={{ backgroundColor: '#E74C3C', color: colors.textLight }}
                            >
                                {processingId === userId ? 'Rejecting...' : (<><Trash2 className="h-4 w-4 mr-1" />Reject</>)}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Define props for MemberManagementPanel
interface MemberManagementPanelProps {
    firebase: FirebaseState;
    clubDetails: ClubDetails;
}

// Owner component to manage current members (removal/kicking out)
// const MemberManagementPanel: React.FC<MemberManagementPanelProps> = ({ firebase, clubDetails }) => {
//     const [processingId, setProcessingId] = useState<string | null>(null);
//     const clubDocRef: DocumentReference<DocumentData> = doc(firebase.db as Firestore, `/artifacts/${appId}/public/data/clubs`, clubDetails.id);

//     // Filter out the owner
//     const membersToDisplay = clubDetails.memberNames 
//         ? clubDetails.memberNames.filter(m => m.id !== firebase.userId)
//         : [];

//     const removeMember = async (member: { id: string; name: string }) => {
//         const requiredInput = `KICK ${member.name}`;
//         const confirmationInput = window.prompt(`Type "${requiredInput}" to confirm removing (kicking out) ${member.name} from the club.`)
        
//         if (confirmationInput !== requiredInput) return;

//         setProcessingId(member.id);
//         try {
//             const newMemberNames = (clubDetails.memberNames || []).filter(m => m.id !== member.id);

//             const updates: DocumentData = { 
//                 members: arrayRemove(member.id),
//                 memberNames: newMemberNames 
//             };

//             if (clubDetails.pendingMembers.includes(member.id)) {
//                  updates.pendingMembers = arrayRemove(member.id);
//             }

//             await withRetry(() => updateDoc(clubDocRef, updates));
//         } catch (error) {
//             console.error(`Error removing member ${member.id}:`, error);
//         } finally {
//             setProcessingId(null);
//         }
//     };

//     return (
//         <div className="mb-6 p-4 rounded-xl shadow-lg border-2 border-dashed" style={{ backgroundColor: colors.cardBg, borderColor: colors.accent }}>
//             <h3 className="text-xl font-bold mb-3 flex items-center" style={{ color: colors.primary }}>
//                 <Users className="h-5 w-5 mr-2" /> Member Management ({membersToDisplay.length} Members)
//             </h3>
//             <p className="text-sm mb-4" style={{ color: colors.textDark }}>As the owner, you can remove members from the club below.</p>
//             <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar">
//                 {membersToDisplay.map(member => (
//                     <div key={member.id} className="flex items-center justify-between p-3 rounded-lg shadow-sm" style={{ backgroundColor: '#F0F8FF' }}> 
//                         <p className="font-medium text-sm" style={{ color: colors.secondary }}>
//                             <User className="h-4 w-4 inline mr-1" /> {member.name}
//                         </p>
//                         <button 
//                             onClick={() => removeMember(member)} 
//                             disabled={processingId === member.id || !firebase.db} 
//                             className="flex items-center text-xs font-semibold py-1 px-3 rounded-full transition-colors disabled:opacity-50 hover:brightness-110" 
//                             style={{ backgroundColor: '#E74C3C', color: colors.textLight }}
//                         >
//                             {processingId === member.id ? 'Removing...' : (<><UserX className="h-4 w-4 mr-1" />Remove Member</>)}
//                         </button>
//                     </div>
//                 ))}
//             </div>
//         </div>
//     );
// };

// Define props for EditCurrentBook
interface EditCurrentBookProps {
    firebase: FirebaseState;
    clubDetails: ClubDetails;
}

// Owner component to edit the current book title and author
const EditCurrentBook: React.FC<EditCurrentBookProps> = ({ firebase, clubDetails }) => {
    const initialBook = clubDetails.currentBook;

    const [newBookTitle, setNewBookTitle] = useState<string>(initialBook.title);
    const [newBookAuthor, setNewBookAuthor] = useState<string>(initialBook.author);
    const [newBookChapters, setNewBookChapters] = useState<number | null>(initialBook.chapters);
    
    const [loading, setLoading] = useState<boolean>(false);
    const [message, setMessage] = useState<string>('');
    const clubDocRef: DocumentReference<DocumentData> = doc(firebase.db as Firestore, `/artifacts/${appId}/public/data/clubs`, clubDetails.id);

    useEffect(() => {
        setNewBookTitle(clubDetails.currentBook.title);
        setNewBookAuthor(clubDetails.currentBook.author);
        setNewBookChapters(clubDetails.currentBook.chapters);
    }, [clubDetails.currentBook]);

    const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setMessage('');
        const trimmedTitle = newBookTitle.trim();
        const trimmedAuthor = newBookAuthor.trim();
        
        const titleChanged = trimmedTitle !== initialBook.title;

        const chaptersValue: number | null = (
            newBookChapters === null || isNaN(newBookChapters) || newBookChapters <= 0 
            ? null 
            : Math.floor(newBookChapters)
        ); 

        if (!trimmedTitle) {
            setMessage('Book title cannot be empty.');
            return;
        }

        if (trimmedTitle === initialBook.title && 
            trimmedAuthor === initialBook.author &&
            chaptersValue === initialBook.chapters) {
             setMessage('No changes detected.');
             return;
        }

        const newBookData: CurrentBook = { title: trimmedTitle, author: trimmedAuthor, chapters: chaptersValue };
        
        setLoading(true);
        try {
            await withRetry(() => updateDoc(clubDocRef, { currentBook: newBookData }));
            
            if (titleChanged) {
                await clearClubChat(firebase.db, clubDetails.id);
                setMessage('Current Read updated and previous discussion cleared! (Book title change)');
            } else {
                 setMessage('Current Read successfully updated!');
            }

            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error("Error updating current book:", error);
            setMessage('Failed to update book. Try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mb-6 p-4 rounded-xl shadow-lg border-2 border-dashed" style={{ backgroundColor: colors.cardBg, borderColor: colors.accent }}>
            <h3 className="text-lg font-bold mb-3 flex items-center" style={{ color: colors.primary }}>
                <Pencil className="h-5 w-5 mr-2" /> Update Current Read
            </h3>
            <form onSubmit={handleUpdate} className="flex flex-col gap-3">
                <input 
                    type="text" 
                    className="flex-grow p-3 rounded-lg shadow-inner focus:outline-none" 
                    style={{ backgroundColor: '#F0F0F0', border: `1px solid ${colors.secondary}` }} 
                    value={newBookTitle} 
                    onChange={(e) => setNewBookTitle(e.target.value)} 
                    placeholder="Book Title (e.g., Dune)"
                    disabled={loading}
                />
                <input 
                    type="text" 
                    className="flex-grow p-3 rounded-lg shadow-inner focus:outline-none" 
                    style={{ backgroundColor: '#F0F0F0', border: `1px solid ${colors.secondary}` }} 
                    value={newBookAuthor} 
                    onChange={(e) => setNewBookAuthor(e.target.value)} 
                    placeholder="Author Name (e.g., Frank Herbert)"
                    disabled={loading}
                />
                <input 
                    type="number" 
                    min="0"
                    className="flex-grow p-3 rounded-lg shadow-inner focus:outline-none" 
                    style={{ backgroundColor: '#F0F0F0', border: `1px solid ${colors.secondary}` }} 
                    value={newBookChapters ?? ''} 
                    onChange={(e) => {
                        const value = e.target.value;
                        setNewBookChapters(value === '' ? null : parseInt(value, 10)); 
                    }} 
                    placeholder="Total Chapters (Optional)"
                    disabled={loading}
                />
                <button 
                    type="submit" 
                    className="flex items-center justify-center py-3 px-6 rounded-full text-sm font-semibold transition-transform hover:scale-[1.02] disabled:opacity-50 w-full" 
                    style={{ backgroundColor: colors.accent, color: colors.textLight }} 
                    disabled={loading || !newBookTitle.trim()}
                >
                    {loading ? 'Saving...' : 'Set Book'}
                </button>
            </form>
            {message && (
                <p className={`text-sm mt-3 ${message.includes('success') ? 'text-green-600' : 'text-red-500'}`}>{message}</p>
            )}
        </div>
    );
};

// Define props for AnnouncementPanel
interface AnnouncementPanelProps {
    firebase: FirebaseState;
    clubDetails: ClubDetails;
}

// Announcement Panel for owner editing and member viewing
const AnnouncementPanel: React.FC<AnnouncementPanelProps> = ({ firebase, clubDetails }) => {
    const [newAnnouncementText, setNewAnnouncementText] = useState<string>(clubDetails.announcement || '');
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [message, setMessage] = useState<string>('');
    
    const isOwner = clubDetails.isOwner;
    const clubDocRef: DocumentReference<DocumentData> = doc(firebase.db as Firestore, `/artifacts/${appId}/public/data/clubs`, clubDetails.id);

    // Sync state when clubDetails (and thus the announcement) updates from Firestore
    useEffect(() => {
        setNewAnnouncementText(clubDetails.announcement || '');
        setIsEditing(false); 
    }, [clubDetails.announcement]);
    
    const userName = `User_${firebase.userId?.substring(0, 8) || 'Unknown'}`;

    const handleSave = async () => {
        setLoading(true);
        setMessage('');
        const trimmedAnnouncement = newAnnouncementText.trim();

        if (!trimmedAnnouncement && clubDetails.announcement) {
             const confirmClearInput = prompt("To clear the announcement, type 'CLEAR'.");
             if (confirmClearInput !== 'CLEAR') {
                 setLoading(false);
                 return;
             }
        }
        
        try {
            await withRetry(() => updateDoc(clubDocRef, { 
                announcement: trimmedAnnouncement,
                announcementAuthor: userName,
                announcementTimestamp: serverTimestamp() // Correct for writing to Firestore
            }));
            setMessage('Announcement saved successfully!');
            setIsEditing(false);
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error("Error saving announcement:", error);
            setMessage('Failed to save announcement. Try again.');
        } finally {
            setLoading(false);
        }
    };
    
    const displayAnnouncement = clubDetails.announcement?.trim() 
        ? clubDetails.announcement.trim() 
        : (isOwner ? "Click 'Edit' to set an announcement for your club." : "No club announcement has been set yet.");

    // Use the number timestamp from clubDetails state (which is guaranteed to be a number|null now)
    const lastUpdated: Date | null = clubDetails.announcementTimestamp 
        ? new Date(clubDetails.announcementTimestamp) 
        : null;

    return (
        <div className="mt-6 p-4 rounded-xl shadow-lg" style={{ backgroundColor: colors.cardBg }}>
            <div className="flex justify-between items-center mb-3 border-b pb-2" style={{ borderColor: colors.accent }}>
                <h4 className="text-lg font-bold flex items-center" style={{ color: colors.primary }}>
                    <Megaphone className="h-5 w-5 mr-2" /> Club Announcements
                </h4>
                {isOwner && !isEditing && (
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="flex items-center text-xs font-semibold py-2 px-4 rounded-full transition-transform hover:scale-105"
                        style={{ backgroundColor: colors.accent, color: colors.textLight }}
                    >
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                    </button>
                )}
            </div>

            {isOwner && isEditing ? (
                <div className="space-y-3">
                    <textarea
                        rows={4}
                        className="w-full p-3 rounded-lg shadow-inner focus:outline-none resize-none"
                        style={{ backgroundColor: '#F0F0F0', border: `1px solid ${colors.secondary}` }}
                        value={newAnnouncementText}
                        onChange={(e) => setNewAnnouncementText(e.target.value)}
                        placeholder="Type your club announcement here..."
                        disabled={loading}
                    />
                    <div className="flex justify-end space-x-2">
                        <button 
                            onClick={() => {setIsEditing(false); setNewAnnouncementText(clubDetails.announcement || '');}}
                            className="py-2 px-4 rounded-full text-sm font-semibold transition-colors disabled:opacity-50 bg-gray-200 text-gray-700" 
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSave}
                            className="py-2 px-4 rounded-full text-sm font-semibold transition-transform hover:scale-[1.03] disabled:opacity-50" 
                            style={{ backgroundColor: colors.secondary, color: colors.textLight }}
                            disabled={loading}
                        >
                            {loading ? 'Saving...' : 'Save Announcement'}
                        </button>
                    </div>
                </div>
            ) : (
                <div 
                    className={`p-3 rounded-lg shadow-inner ${clubDetails.announcement ? 'border-l-4' : 'border-l-2 border-dashed'}`} 
                    style={{ backgroundColor: '#F0F8FF', borderColor: colors.accent, minHeight: '5rem' }} 
                >
                    <p className={`whitespace-pre-wrap ${clubDetails.announcement ? 'text-gray-800' : 'italic text-gray-500'}`}>
                        {displayAnnouncement}
                    </p>
                    {lastUpdated && clubDetails.announcement && (
                        <p className="text-xs text-right mt-2 pt-1 border-t" style={{ borderColor: colors.secondary, color: colors.secondary }}>
                            <span className='font-semibold'>Last Update:</span> {lastUpdated.toLocaleDateString()} {formatTimestamp(lastUpdated.getTime())} by {clubDetails.announcementAuthor || 'Owner'}
                        </p>
                    )}
                </div>
            )}
            {message && (
                <p className={`text-sm mt-3 ${message.includes('success') ? 'text-green-600' : 'text-red-500'}`}>{message}</p>
            )}
        </div>
    );
};

// Define props for DiscussionPanel
interface DiscussionPanelProps {
    firebase: FirebaseState;
    clubDetails: ClubDetails;
    chapterNumber: number;
}

// Component that renders the chat section, separated by chapter (chapter >= 1)
const DiscussionPanel: React.FC<DiscussionPanelProps> = ({ firebase, clubDetails, chapterNumber }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState<string>('');
    const canChat = clubDetails?.status === 'member';
    
    // Chat Listener
    useEffect(() => {
        if (!firebase.db || !clubDetails || !canChat) {
            setMessages([]);
            return;
        }

        const chatCollectionRef = collection(firebase.db, `/artifacts/${appId}/public/data/club_chat`);
        const q: Query<DocumentData> = query(
            chatCollectionRef, 
            where('clubId', '==', clubDetails.id),
            where('chapter', '==', chapterNumber) 
        ); 

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const liveMessages: ChatMessage[] = snapshot.docs.map(doc => {
                const data = doc.data();
                
                // SIMPLIFICATION: Use the utility function for clean conversion
                const timestampInMs = getTimestampInMs(data.timestamp) || Date.now();
                
                return { 
                    id: doc.id, 
                    user: data.user || 'Unknown User',
                    userId: data.userId,
                    text: data.text,
                    timestamp: timestampInMs,
                    clubId: data.clubId,
                    chapter: data.chapter,
                } as ChatMessage;
            }).sort((a, b) => a.timestamp - b.timestamp);

            setMessages(liveMessages);
        });

        return () => unsubscribe();
    }, [firebase.db, clubDetails, chapterNumber, canChat]);
    
    // Auto-scroll
    useEffect(() => {
      const chatContainer = document.getElementById('chat-container');
      if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
    }, [messages]);

    // Send Handler
    const handleSend = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const trimmedInput = chatInput.trim();
        
        if (!trimmedInput || !firebase.db || !firebase.userId || !clubDetails.id || !canChat) return;
        
        try {
            const chatCollectionRef = collection(firebase.db, `/artifacts/${appId}/public/data/club_chat`);
            await withRetry(() => addDoc(chatCollectionRef, {
                user: `User_${firebase.userId?.substring(0, 8)}`, 
                userId: firebase.userId,
                text: trimmedInput,
                timestamp: serverTimestamp(),
                clubId: clubDetails.id, 
                chapter: chapterNumber,
            }));
            setChatInput('');
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    return (
        <div className="mt-6">
            <h4 className="text-lg font-bold mb-3" style={{ color: colors.secondary }}>
                Discussion for Chapter {chapterNumber}
            </h4>
            
            <div 
                id="chat-container"
                className="h-64 md:h-80 overflow-y-auto space-y-3 p-3 rounded-lg custom-scrollbar" 
                style={{ backgroundColor: colors.secondary, boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)' }}
            >
                {canChat ? (
                    messages.length > 0 ? (
                        messages.map((message) => (
                            <ChatBubble key={message.id} message={message} isCurrentUser={message.userId === firebase.userId} />
                        ))
                    ) : (
                        <div className='flex items-center justify-center h-full text-center text-gray-400'><p>No messages yet! Start the discussion.</p></div>
                    )
                ) : (
                    <div className='flex items-center justify-center h-full text-center text-red-300 p-4'>
                        <p className='font-semibold'><Hourglass className='h-5 w-5 inline mr-2'/> Membership pending approval...</p>
                    </div>
                )}
            </div>

            <form onSubmit={handleSend} className="flex mt-4">
                <input
                    type="text"
                    placeholder={canChat ? "Join the chat your comments here." : "Waiting for membership approval..."}
                    className="flex-grow p-3 text-sm focus:outline-none rounded-l-2xl shadow-inner placeholder-gray-600"
                    style={{ backgroundColor: colors.accent, color: colors.textLight, border: 'none' }}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={!canChat}
                />
                <button
                    type="submit"
                    className="p-3 rounded-r-2xl flex items-center justify-center transition-colors hover:brightness-110 disabled:opacity-50"
                    style={{ backgroundColor: colors.accent }}
                    disabled={!chatInput.trim() || !canChat}
                >
                    <Send className="h-5 w-5" style={{ color: colors.textLight }} />
                </button>
            </form>
        </div>
    );
}

// Define props for ChapterList
interface ChapterListProps {
    chapters: number | null;
    setView: (view: string) => void;
    setActiveChapterNumber: (chapter: number | null) => void;
}

// Component to list chapters for discussion
const ChapterList: React.FC<ChapterListProps> = ({ chapters, setView, setActiveChapterNumber }) => {
    if (chapters === null || chapters <= 0) return null;

    const chapterArray: number[] = Array.from({ length: chapters }, (_, i) => i + 1);

    const handleChapterClick = (chapterNum: number) => {
        setActiveChapterNumber(chapterNum);
        setView('chapterDiscussion');
    };

    return (
        <div className="mb-6 p-4 rounded-xl shadow-lg border-2 border-dashed" style={{ backgroundColor: colors.cardBg, borderColor: colors.secondary }}>
            <h3 className="text-xl font-bold mb-3 flex items-center" style={{ color: colors.primary }}>
                <BookOpen className="h-5 w-5 mr-2" /> Chapter Discussions ({chapters} total)
            </h3>
            <p className="text-sm mb-4" style={{ color: colors.textDark }}>Jump into a specific chapter's conversation.</p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 max-h-48 overflow-y-auto custom-scrollbar p-1">
                {chapterArray.map(chapterNum => (
                    <button
                        key={chapterNum}
                        onClick={() => handleChapterClick(chapterNum)}
                        className="py-2 rounded-lg text-xs font-semibold transition-transform hover:scale-105"
                        style={{ backgroundColor: colors.accent, color: colors.textLight }}
                    >
                        Ch. {chapterNum}
                    </button>
                ))}
            </div>
        </div>
    );
};

// Define props for ClubDetailFeatures
interface ClubDetailFeaturesProps {
    firebase: FirebaseState;
    activeClubDetails: ClubDetails | null;
    setView: (view: string) => void;
    setActiveChapterNumber: (chapter: number | null) => void;
}

const ClubDetailFeatures: React.FC<ClubDetailFeaturesProps> = ({ firebase, activeClubDetails, setView, setActiveChapterNumber }) => {
    
    if (!activeClubDetails) return null; 
    
    const bookDisplay = useMemo(() => {
        const book = activeClubDetails.currentBook;
        
        let display = book.title || 'TBD';
        if (book.author?.trim()) { // SIMPLIFICATION: Use optional chaining
            display += ` by ${book.author.trim()}`;
        }
        return { display, chapters: book.chapters }; 
    }, [activeClubDetails.currentBook]);

    return (
        <div className="mt-6">
            {/* Active Club Details Card */}
            <div className="p-4 rounded-xl shadow-lg mb-6" style={{ backgroundColor: colors.cardBg }}>
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold" style={{ color: colors.primary }}>{activeClubDetails.name}</h3>
                    {activeClubDetails.isOwner && (
                        <span className="text-xs font-semibold py-1 px-3 rounded-full" style={{ backgroundColor: colors.secondary, color: colors.textLight }}>Owner</span>
                    )}
                </div>
                <p className="text-sm mb-4" style={{ color: colors.textDark }}>{activeClubDetails.description}</p>
                <div className="space-y-3 text-sm">
                    <div className="flex items-center p-3 rounded-lg" style={{ backgroundColor: '#F0F8FF' }}> 
                        <BookOpen className="h-4 w-4 mr-2" style={{ color: colors.secondary }} />
                        <div>
                            <p className="font-semibold text-xs" style={{ color: colors.secondary }}>Current Read:</p>
                            <p style={{ color: colors.textDark }}>{bookDisplay.display}</p>
                        </div>
                    </div>
                    {/* Display Chapters */}
                    {bookDisplay.chapters !== null && bookDisplay.chapters > 0 && (
                        <div className="flex items-center p-3 rounded-lg" style={{ backgroundColor: '#F0F8FF' }}>
                            <ListOrdered className="h-4 w-4 mr-2" style={{ color: colors.secondary }} />
                            <div>
                                <p className="font-semibold text-xs" style={{ color: colors.secondary }}>Total Chapters:</p>
                                <p style={{ color: colors.textDark }}>{bookDisplay.chapters}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <AnnouncementPanel firebase={firebase} clubDetails={activeClubDetails} />

            <ChapterList 
                chapters={bookDisplay.chapters} 
                setView={setView} 
                setActiveChapterNumber={setActiveChapterNumber}
            />
            
        </div>
    );
};

// Define props for ChapterDiscussionView
interface ChapterDiscussionViewProps {
    firebase: FirebaseState;
    activeClubDetails: ClubDetails | null;
    setView: (view: string) => void;
    activeChapterNumber: number | null;
}

const ChapterDiscussionView: React.FC<ChapterDiscussionViewProps> = ({ firebase, activeClubDetails, setView, activeChapterNumber }) => {
    
    // Use optional chaining and a single return for guards
    if (!activeClubDetails || activeChapterNumber === null || activeClubDetails.status !== 'member') {
        setView('dashboard');
        return null;
    }
    
    const chapterName = `Chapter ${activeChapterNumber}`;
    const bookTitle = activeClubDetails.currentBook.title || 'Current Book';

    return (
        <div className="p-6 pt-10" style={{ backgroundColor: colors.cardBg, minHeight: 'calc(100vh - 4rem)' }}>
            <button 
                onClick={() => setView('clubDetail')} 
                className="mb-4 flex items-center text-sm font-semibold transition-colors hover:opacity-80"
                style={{ color: colors.secondary }}
            >
                <ChevronLeft className="h-4 w-4 mr-1" /> Back to {activeClubDetails.name}
            </button>
            
            <h2 className="text-2xl font-bold" style={{ color: colors.primary }}>{bookTitle}</h2>
            <h3 className="text-xl font-semibold mb-6" style={{ color: colors.accent }}>{chapterName} Discussion</h3>
            
            <DiscussionPanel 
                firebase={firebase} 
                clubDetails={activeClubDetails} 
                chapterNumber={activeChapterNumber} 
            />
            
        </div>
    );
};

// Define props for LeaveClubButton
interface LeaveClubButtonProps {
    firebase: FirebaseState;
    clubDetails: ClubDetails;
    setView: (view: string) => void;
    setActiveClubId: (id: string | null) => void;
    userClubs: ClubDetails[]; // Required by the component's parent
    setUserClubs: React.Dispatch<React.SetStateAction<ClubDetails[]>>; // Required by the component's parent
}

// Component for a member to voluntarily leave the club
const LeaveClubButton: React.FC<LeaveClubButtonProps> = ({ firebase, clubDetails, setView, setActiveClubId }) => {
    const [loading, setLoading] = useState<boolean>(false);
    
    const handleLeave = async () => {
        if (!firebase.db || !firebase.userId || clubDetails.status !== 'member') return;

        setLoading(true); 
        try {
            const clubDocRef: DocumentReference<DocumentData> = doc(firebase.db as Firestore, `/artifacts/${appId}/public/data/clubs`, clubDetails.id);
            
            const userMemberName = clubDetails.memberNames.find(m => m.id === firebase.userId);

            const updates: DocumentData = { 
                members: arrayRemove(firebase.userId),
                ...(userMemberName && { memberNames: arrayRemove(userMemberName) })
            };

            await withRetry(() => updateDoc(clubDocRef, updates));

            setActiveClubId(null);
            setView('dashboard'); 
        } catch (error) {
            console.error("Error leaving club:", error);
            setLoading(false); 
        }
    };
    
    const leaveText = clubDetails.isOwner ? "Leave Club (Owner)" : "Leave Club";
    const buttonStyle = { backgroundColor: '#00A3C9', color: colors.textLight };

    return (
        <button 
            onClick={handleLeave} 
            disabled={loading || clubDetails.status !== 'member'}
            className={`flex items-center justify-center py-3 px-6 rounded-full text-sm font-semibold transition-transform hover:scale-[1.02] disabled:opacity-50 mt-8 w-full shadow-lg`}
            style={buttonStyle}
        >
            {loading ? (<>Leaving...</>) : (<><UserX className='h-5 w-5 mr-2' />{leaveText}</>)}
        </button>
    );
};


// Define props for ClubDetailView
interface ClubDetailViewProps {
    firebase: FirebaseState;
    activeClubDetails: ClubDetails | null;
    setView: (view: string) => void;
    setActiveClubId: (id: string | null) => void;
    setActiveChapterNumber: (chapter: number | null) => void;
    userClubs: ClubDetails[];
    setUserClubs: React.Dispatch<React.SetStateAction<ClubDetails[]>>;
}


// Component combining all features for a club (routing point)
const ClubDetailView: React.FC<ClubDetailViewProps> = ({ 
    firebase, activeClubDetails, setView, setActiveClubId, setActiveChapterNumber, userClubs, setUserClubs
}) => {
    
    if (!activeClubDetails) {
        return (
            <div className="p-6 pt-10" style={{ backgroundColor: colors.cardBg, minHeight: 'calc(100vh - 4rem)' }}>
                <p className="text-center text-red-500">Loading club details...</p>
                <button 
                    onClick={() => setView('dashboard')} 
                    className="mt-4 w-full py-3 rounded-full font-semibold flex items-center justify-center"
                    style={{ backgroundColor: colors.accent, color: colors.textLight }}
                >
                    <ChevronLeft className='h-4 w-4 mr-2' />Back to Dashboard
                </button>
            </div>
        );
    }
    
    const { status, isOwner, pendingMembers, memberNames } = activeClubDetails;
    const isMember = status === 'member';
    const isPending = status === 'pending';

    let content: React.ReactNode;
    
    if (isMember) {
        content = (
            <>
                {/* OWNER FEATURE: Pending Member Approvals */}
                {(isOwner && pendingMembers.length > 0) && (
                    <OwnerPanel firebase={firebase} clubDetails={activeClubDetails} />
                )}
                
                {/* OWNER FEATURE: Member Management */}
                {/* {isOwner && memberNames.length > 1 && ( 
                    <MemberManagementPanel firebase={firebase} clubDetails={activeClubDetails} />
                )} */}
                
                {/* OWNER FEATURE: Edit Current Read */}
                {isOwner && (
                    <EditCurrentBook firebase={firebase} clubDetails={activeClubDetails} />
                )}

                {/* MEMBER FEATURE */}
                <ClubDetailFeatures 
                    firebase={firebase} 
                    activeClubDetails={activeClubDetails} 
                    setView={setView} 
                    setActiveChapterNumber={setActiveChapterNumber}
                />
                
                {/* MEMBER ACTION: Leave Club Button */}
                <LeaveClubButton 
                    firebase={firebase} 
                    clubDetails={activeClubDetails} 
                    setView={setView} 
                    setActiveClubId={setActiveClubId}
                    userClubs={userClubs}
                    setUserClubs={setUserClubs}
                />
            </>
        );
    } else if (isPending) {
        content = (
             <div className="text-center p-8 rounded-xl shadow-xl border-4 border-dashed" style={{ backgroundColor: colors.cardBg, borderColor: colors.accent }}>
                <Hourglass className='h-12 w-12 mx-auto mb-4' style={{ color: colors.primary }} />
                <h3 className='text-2xl font-bold' style={{ color: colors.primary }}>Awaiting Approval</h3>
                <p className='mt-3 text-lg' style={{ color: colors.textDark }}>Your request to join **{activeClubDetails.name}** is currently being reviewed by the owner.</p>
                <p className='mt-2 text-sm text-gray-500'>Please check back later! Once approved, you will see the club's full content here.</p>
            </div>
        );
    } else {
        content = (
            <div className="text-center p-8 rounded-xl" style={{ backgroundColor: colors.cardBg }}>
                <h3 className='text-xl font-bold' style={{ color: colors.primary }}>Access Denied</h3>
                <p className='mt-2' style={{ color: colors.textDark }}>You are not a member of this club and have not submitted a request to join.</p>
            </div>
        );
    }


    return (
        <div className="p-6 pt-10" style={{ backgroundColor: colors.cardBg, minHeight: 'calc(100vh - 4rem)' }}>
            <button 
                onClick={() => setView('dashboard')} 
                className="mb-4 flex items-center text-sm font-semibold transition-colors hover:opacity-80"
                style={{ color: colors.secondary }}
            >
                <ChevronLeft className="h-4 w-4 mr-1" /> Back to My Clubs
            </button>
            
            {content}
            
        </div>
    );
};

// Define props for JoinClubView
interface JoinClubViewProps {
    setView: (view: string) => void;
    setActiveClubId: (id: string | null) => void;
    firebase: FirebaseState;
    userId: string | null;
}

const JoinClubView: React.FC<JoinClubViewProps> = ({ setView, setActiveClubId, firebase, userId }) => {
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [searchResults, setSearchResults] = useState<ClubDetails[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    
    const fetchClubs = useCallback(async (queryValue: string = '') => {
        setError('');
        setLoading(true);
        setSearchResults([]);
        if (!firebase.db || !userId) { setError('Database or User not ready.'); setLoading(false); return; }

        try {
            const clubsCollectionRef = collection(firebase.db, `/artifacts/${appId}/public/data/clubs`);
            let q: Query<DocumentData> | CollectionReference<DocumentData>;
            const trimmedQuery = queryValue.trim();
            
            q = trimmedQuery 
                ? query(clubsCollectionRef, where('name', '>=', trimmedQuery), where('name', '<=', trimmedQuery + '\uf8ff'))
                : clubsCollectionRef;
            
            const snapshot = await withRetry(() => getDocs(q));
            
            if (snapshot.empty && trimmedQuery) { setError('No clubs found matching that name.'); }
            
            const results: ClubDetails[] = snapshot.docs.map(doc => {
                const data = doc.data() as ClubBase;
                const isMember = (data.members || []).includes(userId);
                const isPending = (data.pendingMembers || []).includes(userId);

                return {
                    id: doc.id, 
                    ...data,
                    isOwner: data.creatorId === userId,
                    status: isMember ? 'member' : (isPending ? 'pending' : 'none'),
                    currentBook: data.currentBook && typeof data.currentBook === 'object' && 'title' in data.currentBook
                        ? data.currentBook 
                        : { title: (data.currentBook as string) || 'TBD', author: '', chapters: null },
                    announcementTimestamp: getTimestampInMs(data.announcementTimestamp),
                };
            }).filter(club => club.status !== 'member') as ClubDetails[];
            
            setSearchResults(results);
        } catch (err) {
            console.error("Error fetching clubs:", err);
            setError('Error fetching clubs. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [firebase.db, userId]);

    useEffect(() => {
        if (firebase.db && !searchResults.length && !searchQuery.trim()) {
            fetchClubs();
        }
    }, [firebase.db, fetchClubs, searchResults.length, searchQuery]); 

    const handleSearch = (e?: React.FormEvent<HTMLFormElement>) => {
        if (e) e.preventDefault();
        fetchClubs(searchQuery);
    };

    const handleJoinOrRequest = async (club: ClubDetails) => {
        if (!firebase.db || !userId) return;
        try {
            const clubDocRef: DocumentReference<DocumentData> = doc(firebase.db, `/artifacts/${appId}/public/data/clubs`, club.id);
            setLoading(true);

            if (club.requiresApproval) {
                await withRetry(() => updateDoc(clubDocRef, { pendingMembers: arrayUnion(userId) }));
                await fetchClubs(searchQuery); 
                setError(`Request to join "${club.name}" sent! Awaiting owner approval.`);
            } else {
                await withRetry(() => updateDoc(clubDocRef, { 
                    members: arrayUnion(userId),
                    memberNames: arrayUnion({id: userId, name: `User_${userId.substring(0, 8)}`})
                }));
                setActiveClubId(club.id);
                setView('clubDetail');
            }
        } catch (err) {
            console.error("Error processing join/request:", err);
            setError('Failed to process join/request. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 pt-10" style={{ backgroundColor: colors.cardBg, minHeight: 'calc(100vh - 4rem)' }}>
            <h2 className="text-2xl font-bold mb-4" style={{ color: colors.primary }}>Find and Join a Club</h2>
            <form onSubmit={handleSearch} className="flex mb-6 shadow-md rounded-lg overflow-hidden">
                <input type="text" className="flex-grow p-3 text-sm focus:outline-none" style={{ backgroundColor: '#F0F0F0', color: colors.textDark }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by Club Name" disabled={loading}/>
                <button type="submit" className="p-3 flex items-center justify-center transition-colors hover:brightness-110 disabled:opacity-50" style={{ backgroundColor: colors.accent, color: colors.textLight }} disabled={loading}>
                    <Search className="h-5 w-5" />
                </button>
            </form>

            {loading && <p className="text-sm" style={{ color: colors.secondary }}>Searching for clubs...</p>}
            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="space-y-4 max-h-96 overflow-y-auto">
                {searchResults.map((club) => (
                    <div key={club.id} className="p-4 rounded-xl shadow-lg flex justify-between items-center" style={{ backgroundColor: colors.cardBg }}>
                        <div>
                            <p className="font-semibold" style={{ color: colors.primary }}>{club.name}</p>
                            <p className="text-xs mt-1 text-gray-500">{club.members.length} Approved Members</p>
                        </div>
                        {club.status === 'pending' ? (
                            <div className="flex items-center py-2 px-3 rounded-full text-xs font-semibold" style={{ backgroundColor: '#D6EEF5', color: colors.primary }}>
                                <Hourglass className="h-4 w-4 mr-1" />Pending
                            </div>
                        ) : (
                            <button
                                className="py-2 px-4 rounded-full text-xs font-semibold transition-transform hover:scale-105"
                                style={{ backgroundColor: club.requiresApproval ? colors.secondary : colors.accent, color: colors.textLight }}
                                onClick={() => handleJoinOrRequest(club)}
                                disabled={loading}
                            >
                                {club.requiresApproval ? 'Request Join' : 'Join Instantly'}
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <button type="button" className="mt-6 w-full py-3 rounded-full text-sm font-semibold transition-colors disabled:opacity-50 bg-gray-200 text-gray-700" onClick={() => setView('dashboard')} disabled={loading}>Back to Dashboard</button>
        </div>
    );
};

// Define props for MainDashboard
interface MainDashboardProps {
    firebase: FirebaseState;
    activeClubId: string | null;
    setActiveClubId: (id: string | null) => void;
    setView: (view: string) => void;
    userClubs: ClubDetails[];
}

const MainDashboard: React.FC<MainDashboardProps> = ({ 
    firebase, activeClubId, setActiveClubId, setView, userClubs
}) => {
    
    const [message, setMessage] = useState<{ text: string; type: 'warning' } | null>(null);

    const handleClubClick = (club: ClubDetails) => {
        if (club.status === 'member') {
            setActiveClubId(club.id);
            setView('clubDetail');
        } else if (club.status === 'pending') {
            setMessage({
                text: `You have a pending request for "${club.name}". Please wait for the owner's approval.`,
                type: 'warning'
            });
            setTimeout(() => setMessage(null), 4000);
        }
    };
    
    const hasClubs = userClubs.length > 0;

    return (
        <div className="flex flex-col relative min-h-full" style={{ backgroundColor: colors.bg }}>
            
            <header 
                className="flex justify-between items-center p-4 shadow-md sticky top-0 z-10" 
                style={{ backgroundColor: colors.cardBg, borderBottom: `1px solid ${colors.bg}` }}
            >
                <h1 className="text-xl font-bold" style={{ color: colors.primary }}>
                    Book Clubs
                </h1>
                <button 
                    className="p-1 rounded-full transition-colors hover:bg-gray-100"
                    onClick={() => setView('joinClub')}
                >
                    <CirclePlus className="h-6 w-6" style={{ color: colors.accent }} strokeWidth={2.5} />
                </button>
            </header>
            
            {message && (
                <div className="fixed inset-x-0 top-16 z-50 flex items-start justify-center pt-2 pointer-events-none transition-all duration-300">
                    <div className="flex items-center bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-3 rounded-lg shadow-xl animate-bounce-in max-w-sm mx-4" role="alert">
                        <Hourglass className='h-4 w-4 mr-2 flex-shrink-0'/>
                        <div className='text-xs font-medium'>{message.text}</div>
                    </div>
                </div>
            )}

            <main className="flex-grow p-4 overflow-y-auto">
                
                {!hasClubs ? (
                    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-6">
                        <button 
                            className="py-3 px-8 rounded-full text-sm font-semibold transition-transform hover:scale-[1.03] shadow-md"
                            style={{ backgroundColor: colors.accent, color: colors.textLight }}
                            onClick={() => setView('createClub')}
                        >
                            Create Your Own Club
                        </button>                        
                        
                        <BookOpen className="h-16 w-16 mb-6" style={{ color: colors.secondary, opacity: 0.5 }} strokeWidth={1} />
                        
                        <p className="text-xl font-extrabold mb-2" style={{ color: colors.primary }}>
                            No Book Clubs Yet
                        </p>
                        
                        <p className="text-sm mb-8" style={{ color: colors.secondary }}>
                            Join or create a book club to start reading together!
                        </p>
                        
                    </div>
                ) : (
                    <div className="mb-6">
                        <button 
                            className="py-3 px-8 rounded-full text-sm font-semibold transition-transform hover:scale-[1.03] shadow-md"
                            style={{ backgroundColor: colors.accent, color: colors.textLight }}
                            onClick={() => setView('createClub')}
                        >
                            Create Your Own Club
                        </button>
                        <h3 className="text-lg font-bold mb-4" style={{ color: colors.primary }}>Your Active Clubs</h3>
                        <div className="grid grid-cols-1 gap-4">
                            {userClubs.map(club => {
                                const isPending = club.status === 'pending';
                                const isActive = club.id === activeClubId;
                                const currentBookTitle = club.currentBook.title || 'TBD: Set Book'; 
                                
                                return (
                                    <div
                                        key={club.id}
                                        className={`p-4 rounded-xl shadow-lg cursor-pointer transition-all duration-200 border-2 ${isActive ? 'border-4 transform scale-[1.01]' : 'hover:shadow-xl border-transparent'}`}
                                        style={{ 
                                            backgroundColor: isActive ? '#E3F8FF' : colors.cardBg, 
                                            borderColor: isActive ? colors.accent : (isPending ? 'rgba(255,165,0,0.5)' : colors.cardBg),
                                            opacity: isPending ? 0.8 : 1,
                                        }}
                                        onClick={() => handleClubClick(club)}
                                    >
                                        <div className='flex justify-between items-start'>
                                            <p className="font-extrabold text-xl truncate" style={{color: isPending ? colors.secondary : colors.primary}}>{club.name}</p>
                                            {isPending ? (
                                                <span className='text-xs font-semibold py-1 px-2 rounded-full flex items-center' style={{ backgroundColor: '#F0F8FF', color: 'orange' }}>
                                                    <Hourglass className='h-3 w-3 mr-1' />Pending
                                                </span>
                                            ) : (
                                                <span className='text-xs font-medium flex items-center' style={{ color: colors.secondary }}>
                                                    <Users className='h-3 w-3 mr-1' />{club.members.length}
                                                </span>
                                            )}
                                        </div>
                                        
                                        <div className='mt-2 p-2 rounded-lg' style={{ backgroundColor: colors.bg }}>
                                            <p className="text-xs font-medium flex items-center mb-0.5" style={{ color: colors.secondary }}>
                                                <BookOpen className='h-3 w-3 mr-1' /> Current Read
                                            </p>
                                            <p className="text-sm font-semibold truncate" style={{ color: colors.textDark }}>
                                                {currentBookTitle}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};


// ====================================================================================
// APP CORE (Entry Point and State Management)
// ====================================================================================
const App: React.FC = () => {
  const [firebase, setFirebase] = useState<FirebaseState>({ auth: null, db: null, userId: null, isReady: false });
  const [view, setView] = useState<string>('dashboard'); 
  const [activeClubId, setActiveClubId] = useState<string | null>(null); 
  const [userClubs, setUserClubs] = useState<ClubDetails[]>([]); 
  const [activeClubDetails, setActiveClubDetails] = useState<ClubDetails | null>(null); 
  const [activeChapterNumber, setActiveChapterNumber] = useState<number | null>(null);
  
// Firebase Initialization and Auth
  useEffect(() => {
    const setupFirebase = async () => {
      try {
        const app: FirebaseApp = initializeApp(firebaseConfig as any);
        const auth: Auth = getAuth(app);
        const db: Firestore = getFirestore(app);

        onAuthStateChanged(auth, async (user: FirebaseAuthUser | null) => {
            let currentUserId = user?.uid;
            
            if (!user) {
                if (initialAuthToken) {
                    const credentials = await withRetry(() => signInWithCustomToken(auth, initialAuthToken));
                    currentUserId = credentials.user.uid;
                } else {
                    const credentials = await withRetry(() => signInAnonymously(auth));
                    currentUserId = credentials.user.uid;
                }
            }
            
            // FIX: Use nullish coalescing to explicitly convert 'undefined' to 'null'
            const finalUserId: string | null = currentUserId ?? null;

            setFirebase(prev => ({ ...prev, auth, db, userId: finalUserId, isReady: true }));
        });

      } catch (error) {
        console.error("Firebase setup failed:", error);
        setFirebase(prev => ({ ...prev, isReady: true }));
      }
    };
    setupFirebase();
  }, []);

// Mock Data Seeder (Runs once if no clubs exist)
//   useEffect(() => {
//     const seedClubs = async () => {
//       // Only proceed if Firebase is ready and we have the DB instance
//       if (!firebase.isReady || !firebase.db) return;

//       const clubsCollectionRef = collection(firebase.db, `/artifacts/${appId}/public/data/clubs`);

//       try {
//         // Check if any clubs already exist in the database
//         const existingClubsSnapshot = await withRetry(() => getDocs(clubsCollectionRef));

//         // Only seed if the database is currently empty of clubs
//         if (existingClubsSnapshot.empty) {
//           console.log("Database is empty. Seeding mock clubs for testing...");

//           const mockClubs = [
//             {
//               name: "The Approval Critics",
//               description: "A private club for serious, vetted discussions. Owner approval required!",
//               creatorId: "MOCK_OWNER_1", // Use a mock ID for a distinct owner
//               createdAt: serverTimestamp(),
//               members: ["MOCK_OWNER_1"], // MOCK_OWNER_1 is the initial member/creator
//               pendingMembers: [],
//               memberNames: [{ id: "MOCK_OWNER_1", name: "The Mock Owner" }],
//               requiresApproval: true,
//               currentBook: { title: "The Secret History", author: "Donna Tartt", chapters: 10 },
//               announcement: 'Welcome to our exclusive reading group!',
//               announcementAuthor: 'The Mock Owner',
//               announcementTimestamp: serverTimestamp(),
//             },
//             {
//               name: "Instant Fiction Fanatics",
//               description: "A casual club for quick, fun reads. Jump right in!",
//               creatorId: "MOCK_OWNER_2", // Another mock ID
//               createdAt: serverTimestamp(),
//               members: ["MOCK_OWNER_2"], // MOCK_OWNER_2 is the initial member/creator
//               pendingMembers: [],
//               memberNames: [{ id: "MOCK_OWNER_2", name: "The Instant Boss" }],
//               requiresApproval: false,
//               currentBook: { title: "Project Hail Mary", author: "Andy Weir", chapters: 26 },
//               announcement: 'New members welcome! Jump into the chat now.',
//               announcementAuthor: 'The Instant Boss',
//               announcementTimestamp: serverTimestamp(),
//             },
//           ];

//           await Promise.all(mockClubs.map(club => withRetry(() => addDoc(clubsCollectionRef, club))));
//           console.log("Mock clubs seeded successfully.");

//         }
//       } catch (error) {
//         console.error("Error during club seeding process:", error);
//       }
//     };

//     if (firebase.isReady && firebase.db) {
//         // The check inside seedClubs ensures this only runs if the collection is empty.
//         seedClubs();
//     }
//   }, [firebase.isReady, firebase.db]); // Depend only on Firebase readiness

// Combined Listener for User's Clubs (Approved or Pending)
  useEffect(() => {
    if (!firebase.isReady || !firebase.db || !firebase.userId) return;

    const clubsCollectionRef = collection(firebase.db, `/artifacts/${appId}/public/data/clubs`);
    const qMember = query(clubsCollectionRef, where('members', 'array-contains', firebase.userId));
    const qPending = query(clubsCollectionRef, where('pendingMembers', 'array-contains', firebase.userId));

    const unsubs: (() => void)[] = [];
    let currentMemberClubs: (ClubBase & { id: string })[] = [];
    let currentPendingClubs: (ClubBase & { id: string })[] = [];
    
    const mapToClubDetails = (club: any, status: 'member' | 'pending' | 'none'): ClubDetails => ({
        id: club.id,
        ...club,
        status: status,
        isOwner: club.creatorId === firebase.userId,
        currentBook: club.currentBook && typeof club.currentBook === 'object' && 'title' in club.currentBook
            ? club.currentBook as CurrentBook
            : { title: club.currentBook as string || 'TBD', author: '', chapters: null },
        announcementTimestamp: getTimestampInMs(club.announcementTimestamp), // SIMPLIFICATION: Use helper
    });
    
    const updateCombinedClubs = (memberList: any[], pendingList: any[]) => {
        const allClubsMap = new Map<string, ClubDetails>();
        
        memberList.forEach(club => allClubsMap.set(club.id, mapToClubDetails(club, 'member')));
        pendingList.forEach(club => {
            if (!allClubsMap.has(club.id)) {
                 allClubsMap.set(club.id, mapToClubDetails(club, 'pending'));
            }
        });

        const combinedClubs = Array.from(allClubsMap.values());
        
        if (combinedClubs.length > 0 && !activeClubId) {
            const defaultClub = combinedClubs.find(c => c.status === 'member') || combinedClubs[0];
            setActiveClubId(defaultClub.id);
        } else if (combinedClubs.length === 0) {
            setActiveClubId(null);
        }
        
        setUserClubs(combinedClubs);
    };

    unsubs.push(onSnapshot(qMember, (snapshot) => {
        // Map directly to include ID
        currentMemberClubs = snapshot.docs.map(doc => ({id: doc.id, ...doc.data() as ClubBase})); 
        updateCombinedClubs(currentMemberClubs, currentPendingClubs);
    }));

    unsubs.push(onSnapshot(qPending, (snapshot) => {
        // Map directly to include ID
        currentPendingClubs = snapshot.docs.map(doc => ({id: doc.id, ...doc.data() as ClubBase})); 
        updateCombinedClubs(currentMemberClubs, currentPendingClubs);
    }));
    
    return () => unsubs.forEach(unsub => unsub());

  }, [firebase.isReady, firebase.db, firebase.userId, activeClubId]);

  // Dedicated Listener for Active Club Details
  useEffect(() => {
    if (!firebase.db || !activeClubId) {
        setActiveClubDetails(null);
        return;
    }

    const clubDocRef: DocumentReference<DocumentData> = doc(firebase.db, `/artifacts/${appId}/public/data/clubs`, activeClubId);
    
    const unsubscribe = onSnapshot(clubDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data() as any; // Cast to 'any' for data ingestion
            const status = userClubs.find(c => c.id === activeClubId)?.status || 'member'; 
            
            // Use the same helper logic for mapping to state type
            setActiveClubDetails({ 
                id: docSnap.id, 
                ...data,
                status: status, 
                isOwner: data.creatorId === firebase.userId,
                currentBook: data.currentBook && typeof data.currentBook === 'object' && 'title' in data.currentBook
                    ? data.currentBook as CurrentBook
                    : { title: data.currentBook as string || 'TBD', author: '', chapters: null }, 
                pendingMembers: data.pendingMembers || [], 
                memberNames: data.memberNames || [],
                announcement: data.announcement || '',
                announcementAuthor: data.announcementAuthor || '',
                announcementTimestamp: getTimestampInMs(data.announcementTimestamp), 
            });
        } else {
            setActiveClubDetails(null);
             if (userClubs.length > 0) setActiveClubId(userClubs[0].id);
             else setActiveClubId(null);
             if(view === 'clubDetail' || view === 'chapterDiscussion') setView('dashboard');
        }
    }, (error) => {
        console.error("Error fetching active club details:", error);
    });

    return () => unsubscribe();
    
}, [firebase.db, activeClubId, firebase.userId, userClubs, view]);


  // Define a single props object
  const appProps = useMemo(() => ({ 
      firebase, 
      activeClubId, 
      setActiveClubId, 
      setView, 
      userClubs, 
      setUserClubs, 
      activeClubDetails, 
      activeChapterNumber, 
      setActiveChapterNumber
  }), [
      firebase, 
      activeClubId, 
      activeClubDetails, 
      activeChapterNumber, 
      userClubs,
      setActiveClubId, setView, setUserClubs, setActiveChapterNumber 
  ]);

  const renderContent = () => {
    if (!firebase.isReady) {
      return (<div className="p-6 text-center text-lg h-[80vh] flex items-center justify-center" style={{ color: colors.textDark, backgroundColor: colors.cardBg }}>Loading authentication...</div>);
    }

    switch (view) {
      case 'createClub': 
        return <CreateClubForm {...appProps} userId={firebase.userId} />;
      case 'joinClub': 
        return <JoinClubView {...appProps} userId={firebase.userId} />;
      case 'chapterDiscussion': 
        return <ChapterDiscussionView {...appProps} />;
      case 'clubDetail': 
        return <ClubDetailView {...appProps} />;
      case 'dashboard': 
      default:
        return <MainDashboard {...appProps} />;
    }
  };


  return (
    <div className="w-full max-w-md mx-auto shadow-2xl flex flex-col relative min-h-screen" style={{ backgroundColor: colors.bg }}>
        <main className="flex-grow overflow-y-auto">
          {renderContent()}
        </main>
        
        <div className="fixed bottom-0 left-0 p-2 text-xs bg-gray-800 text-gray-400 z-50 rounded-tr-lg">
          User ID: {firebase.userId || '...loading'}
        </div>
        
        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background-color: ${colors.secondary}; border-radius: 4px; border: 2px solid ${colors.bg}; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar { scrollbar-color: ${colors.secondary} transparent; scrollbar-width: thin; }
        `}</style>
    </div>
  );
};

export default App;