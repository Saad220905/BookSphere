import React, { useState } from 'react';
import { StyleSheet, TextInput, View, ActivityIndicator, Alert } from 'react-native';
import { Text } from '../../components/Themed';
import { Button } from 'react-native'; 
import { router } from 'expo-router';
import { fetchBookPdfUrl } from '../../utils/getBook';

export default function SearchScreen() {
    const [query, setQuery] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const handleSearch = async () => {
        if (query.trim() === '') {
            Alert.alert("Empty Search", "Please enter a book title.");
            return;
        }

        setIsLoading(true);
        try {
            const pdfUrl = await fetchBookPdfUrl(query);

            if (pdfUrl) {
                router.push({
                    pathname: "/viewer",
                    params: { url: pdfUrl }
                });
            } else {
                Alert.alert("Not Found", `Could not find a public domain PDF for "${query}". Please try another title.`);
            }
        } catch (error) {
            Alert.alert("Error", "An unexpected error occurred while searching.");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Book Search</Text>
            <Text style={styles.subtitle}>Find public domain books from the Open Library and Internet Archive.</Text>
            
            <TextInput
                style={styles.input}
                placeholder="e.g., The Adventures of Sherlock Holmes"
                placeholderTextColor="#999"
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch} 
            />

            {isLoading ? (
                <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
            ) : (
                <Button
                    title="Search"
                    onPress={handleSearch}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: 'gray',
        textAlign: 'center',
        marginBottom: 24,
    },
    input: {
        width: '100%',
        height: 50,
        backgroundColor: '#fff',
        borderColor: '#ddd',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 15,
        marginBottom: 20,
        fontSize: 16,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.20,
        shadowRadius: 1.41,
        elevation: 2,
    },
    loader: {
        marginTop: 20, 
    }
});
