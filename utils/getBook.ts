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


/**
 * This function performs API calls to OpenLibrary and Internet Archive
 * to find a public domain PDF for a given book title.
 */
export async function fetchBookPdfUrl(title: string): Promise<string | null> {
    console.log(`Searching for PDF URL for '${title}'...`);

    try {
        // Step 1: Search OpenLibrary's API
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

        // Step 2: Verify a PDF copy exists in the Internet Archive link
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

        // Step 3: Return the final PDF URL
        console.log(`Successfully found PDF URL: ${pdfUrl}`);
        return pdfUrl;

    } catch (err) {
        console.error('An error occurred during the fetch process:', err);
        return null;
    }
}
