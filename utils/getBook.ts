import { collection, query, where, getDocs, addDoc, Firestore } from 'firebase/firestore';
import { db } from '../config/firebase';

interface OpenLibraryDoc {
    title: string;
    ebook_access: 'public' | 'restricted' | 'borrowable' | 'printdisabled';
    ia?: string[]; 
    author_name?: string[];
    first_publish_year?: number;
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
    throw new BookSearchError('Firestore is not initialized. Please check your Firebase configuration.');
  }
  return db;
}

/**
 * This function performs API calls to OpenLibrary and Internet Archive
 * to find a public domain PDF for a given book title.
 */
export async function fetchBookPdfUrl(title: string): Promise<string | null> {
    console.log(`Searching for PDF URL for '${title}'...`);

    try {
        // Step 1 : Check Firebase first for title
        const firestore = getFirestoreInstance();
        const booksCollectionRef = collection(firestore, 'books')
        const q = query(booksCollectionRef, where('title', '==', title));

        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // A book with this exact title was found
            const bookDoc = querySnapshot.docs[0];
            const bookData = bookDoc.data();
            console.log(`Found '${bookData.title}' in Firebase.`);
            return bookData.pdf_url;
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
            if (doc.ebook_access === 'public' && doc.ia && apiTitle.includes(title.toLowerCase())) {
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
                        console.log(`Successfully found PDF URL: ${pdfUrl}`);
                        break; // We found a valid PDF, no need to check other identifiers
                    }
                }
            } catch (e) {
                console.log(`Error checking identifier ${identifier}, trying next one.`);
                continue;
            }
        }

        if (!pdfUrl) {
            console.log(`Could not find a verifiable English PDF scan for '${title}'.`);
            return null;
        }
        
        // Step 4 : Final check against Firebase to prevent duplicate titles
        const finalCheckQuery = query(booksCollectionRef, where('title', '==', bookCandidate.title));
        const finalCheckSnapshot = await getDocs(finalCheckQuery);
        
        if (finalCheckSnapshot.empty) {
            const newBookData = {
                title: bookCandidate.title, 
                author: bookCandidate.author_name ? bookCandidate.author_name.join(', ') : 'N/A',
                publish_year: bookCandidate.first_publish_year || 'N/A',
                pdf_url: pdfUrl,
            };
            await addDoc(booksCollectionRef, newBookData);
            console.log(`Successfully ADDED '${newBookData.title}' to Firebase.`);
        } else {
            console.log(`'${bookCandidate.title}' already exists in Firebase. Skipping add.`);
        }

        return pdfUrl;

    } catch (err) {
        console.error('An error occurred during the fetch process:', err);
        return null;
    }
}
