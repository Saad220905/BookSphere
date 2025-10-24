import { collection, query, where, getDocs, doc, setDoc, Firestore, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

interface OpenLibraryDoc {
    title: string;
    ebook_access: 'public' | 'restricted' | 'borrowable' | 'printdisabled';
    ia?: string[]; 
    author_name?: string[];
    first_publish_year?: number;
    cover_i?: number;
}

interface OpenLibraryResponse {
    docs: OpenLibraryDoc[];
}

interface InternetArchiveFile {
    name: string;
    format: string;
}

interface InternetArchiveMetadata {
    metadata?: {
        language?: string;
    };
    files: InternetArchiveFile[];
}

export class BookSearchError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'BookSearchError';
  }
}

function getFirestoreInstance(): Firestore {
  if (!db) {
    throw new BookSearchError('Firestore is not initialized.');
  }
  return db;
}

export interface BookData {
  title: string;
  author: string;
  publish_year: any;
  cover_url: any;
  pdf_url: string;
  book_id: string; 
}

/**
 * This function performs API calls to OpenLibrary and Internet Archive
 * to find a public domain PDF for a given book title.
 */
export async function fetchBookPdfUrl(title: string): Promise<BookData | null>  {
    console.log(`Searching for PDF URL for '${title}'...`);

    try {
        // Step 1 : Check Firebase first for title
        const firestore = getFirestoreInstance();
        const booksCollectionRef = collection(firestore, 'books')

        const normalizedTitle = title.toLowerCase().trim();
        const q = query(booksCollectionRef, where('search_title', '==', normalizedTitle));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // A book with this exact title was found
            const bookDoc = querySnapshot.docs[0];
            const bookData = bookDoc.data();
            console.log(`Found '${bookData.title}' in Firebase.`);
            // console.log(`${bookData.pdf_url} , ${bookData.book_id}`);
            return { 
              title: bookData.title,
              author: bookData.author, 
              publish_year: bookData.publish_year,
              cover_url: bookData.cover_url,
              pdf_url: bookData.pdf_url,
              book_id: bookData.book_id, 
            };

        }
        
        console.log(`'${title}' not found in Firebase. Searching APIs...`);

        // Step 2: Search OpenLibrary's API if not found in Firebase
        const searchUrl = `https://openlibrary.org/search.json?q=title:"${encodeURIComponent(title)}"&language=eng`;
        const olResponse = await fetch(searchUrl);
        const olData: OpenLibraryResponse = await olResponse.json();

        let bookCandidate: OpenLibraryDoc | null = null;
        for (const doc of olData.docs || []) {
            const apiTitle = (doc.title || '').toLowerCase();
            // Find the best match that is public and has an Internet Archive link
            if (doc.ebook_access === 'public' && doc.ia && apiTitle.includes(normalizedTitle)) {
                bookCandidate = doc;
                break; // Use the first suitable candidate
            }
        }

        if (!bookCandidate || !bookCandidate.ia) {
            console.log(`Could not find a suitable public domain version for '${title}' online.`);
            return null;
        }

        // Step 3: Verify a PDF copy exists in the Internet Archive link
        let pdfUrl: string | null = null;
        let workingId: string | null = null;
        let coverUrl: string | null = null;
        for (const identifier of bookCandidate.ia) {
            try {
                const metaUrl = `https://archive.org/metadata/${identifier}`;
                const metaResponse = await fetch(metaUrl);
                const metadata: InternetArchiveMetadata = await metaResponse.json();

                const scanLanguage = (metadata?.metadata?.language || '').toLowerCase();
                if (['eng', 'english'].includes(scanLanguage)) {
                    // Find the first file that ends with .pdf
                    const pdfFile = metadata.files.find(f => f.name.endsWith('.pdf'));
                    if (pdfFile) {
                        pdfUrl = `https://archive.org/download/${identifier}/${encodeURIComponent(pdfFile.name)}`;
                        workingId = identifier;
                        coverUrl = `https://covers.openlibrary.org/b/id/${bookCandidate.cover_i}-M.jpg`;
                        console.log(`Successfully found PDF URL: ${pdfUrl}`);
                        break; // We found a valid PDF, no need to check other identifiers
                    }
                }
            } catch (e) {
                console.log(`Error checking identifier ${identifier}, trying next one.`);
                continue;
            }
        }

        if (!pdfUrl || !workingId ) {
            console.log(`Could not find a verifiable English PDF scan for '${title}'.`);
            return null;
        }
        
        // Step 4 : Final check against Firebase to prevent duplicate titles
        const finalCheckQuery = query(booksCollectionRef, where('search_title', '==', bookCandidate.title.toLowerCase().trim()));
        const finalCheckSnapshot = await getDocs(finalCheckQuery);
        
        if (finalCheckSnapshot.empty) {
            const bookDocRef = doc(firestore, 'books', workingId);
            const newBookData = {
                title: bookCandidate.title, 
                author: bookCandidate.author_name ? bookCandidate.author_name.join(', ') : 'N/A',
                publish_year: bookCandidate.first_publish_year || 'N/A',
                cover_url: coverUrl,
                pdf_url: pdfUrl,
                book_id: workingId,
                search_title: bookCandidate.title.toLowerCase().trim(),
            };
            await setDoc(bookDocRef, newBookData);
            console.log(`Successfully ADDED '${newBookData.title}' to Firebase.`);
            return { 
              title: newBookData.title,
              author: newBookData.author,
              publish_year: newBookData.publish_year,
              cover_url: coverUrl,
              pdf_url: pdfUrl, 
              book_id: workingId, 
            };
        } else {
            const existingDoc = finalCheckSnapshot.docs[0];
            const existingData = existingDoc.data();
            console.log(`'${bookCandidate.title}' already exists in Firebase. Skipping add.`);
            return { 
              title: existingData.title,
              author: existingData.author,
              publish_year: existingData.publish_year,
              cover_url: existingData.cover_url, 
              pdf_url: existingData.pdf_url,
              book_id: existingData.book_id,
            };
        }

    } catch (err) {
        console.error('An error occurred during the fetch process:', err);
        return null;
    }
}


/*
* This function updates a book document in Firestore to add the total page count
*/
export async function updateBookPageCount(bookId: string, pageCount: number): Promise<void> {
  try {
    const firestore = getFirestoreInstance();
    const bookDocRef = doc(firestore, 'books', bookId);

    await updateDoc(bookDocRef, {
      page_count: pageCount
    });
  } catch (error) {
    console.error("Error updating page count:", error);
  }
}