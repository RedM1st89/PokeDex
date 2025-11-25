import { API_BASE, X_KEY } from '@/config/api';
import { useAuth } from '@/context/AuthContext';
import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface Pokemon {
  pokeId: number;
  name: string;
  sprite: string;
  types: string[];
  height: number;
  weight: number;
  abilities: Array<{ name: string; isHidden: boolean }>;
  stats: Array<{ name: string; baseStat: number }>;
  addedAt?: string;
}

const TILE_SIZE = 100;
const TILE_MARGIN = 8;
const ITEMS_PER_PAGE = 20;

export default function PokedexScreen() {
  const { user, signOut, loading: authLoading } = useAuth();
  const [pokemon, setPokemon] = useState<Pokemon[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedPokemon, setSelectedPokemon] = useState<Pokemon | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'name' | 'type' | 'number' | 'favorites'>('all');
  const [favorites, setFavorites] = useState<Pokemon[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [totalPokemon, setTotalPokemon] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [numColumns, setNumColumns] = useState(3);

  useEffect(() => {
    const updateColumns = () => {
      const width = Dimensions.get('window').width - 100; // Subtract nav buttons
      setNumColumns(Math.floor(width / (TILE_SIZE + TILE_MARGIN * 2)));
    };
    updateColumns();
    const subscription = Dimensions.addEventListener('change', updateColumns);
    return () => subscription?.remove();
  }, []);

  // Auto-refresh favorites every 3 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      await fetchFavorites(user.uid, true); // Silent refresh
      // If viewing favorites, refresh the list
      if (filterType === 'favorites') {
        fetchPokemon(currentPage, searchQuery, filterType);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [user, filterType, currentPage, searchQuery]);

  const fetchFavorites = async (firebaseUid: string, silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await fetch(`${API_BASE}/users/${firebaseUid}/pokemon-favorites`, {
        headers: { 'X-API-KEY': X_KEY }
      });
      if (response.status === 404) {
        setFavorites([]);
        setFavoriteIds([]);
        return;
      }
      const data = await response.json();
      const favs = data.pokemonFavorites || [];
      setFavorites(favs);
      setFavoriteIds(favs.map((p: Pokemon) => p.pokeId));
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchPokemon = async (page = 0, search = '', filter: string = 'all') => {
    setLoading(true);
    try {
      const offset = page * ITEMS_PER_PAGE;
      let data, detailedPokemon;

      if (filter === 'favorites') {
        const start = offset;
        const end = start + ITEMS_PER_PAGE;
        setPokemon(favorites.slice(start, end));
        setTotalPokemon(favorites.length);
        setLoading(false);
        return;
      }

      if (filter === 'number' && search) {
        const response = await fetch(`${API_BASE}/pokemon/${search}`, { headers: { 'X-API-KEY': X_KEY } });
        data = await response.json();
        setPokemon([data.pokemon]);
        setTotalPokemon(1);
      } else if (filter === 'name' && search) {
        try {
          const response = await fetch(`${API_BASE}/pokemon/${search.toLowerCase()}`, { headers: { 'X-API-KEY': X_KEY } });
          data = await response.json();
          setPokemon([data.pokemon]);
          setTotalPokemon(1);
        } catch {
          const response = await fetch(`${API_BASE}/pokemon/search/${search.toLowerCase()}`, { headers: { 'X-API-KEY': X_KEY } });
          data = await response.json();
          detailedPokemon = await Promise.all(data.results.slice(offset, offset + ITEMS_PER_PAGE).map(async (p: any) => {
            const res = await fetch(`${API_BASE}/pokemon/${p.name}`, { headers: { 'X-API-KEY': X_KEY } });
            return (await res.json()).pokemon;
          }));
          setPokemon(detailedPokemon);
          setTotalPokemon(data.count);
        }
      } else if (filter === 'type' && search) {
        const response = await fetch(`${API_BASE}/pokemon/type/${search.toLowerCase()}`, { headers: { 'X-API-KEY': X_KEY } });
        data = await response.json();
        detailedPokemon = await Promise.all(data.results.slice(offset, offset + ITEMS_PER_PAGE).map(async (p: any) => {
          const res = await fetch(`${API_BASE}/pokemon/${p.name}`, { headers: { 'X-API-KEY': X_KEY } });
          return (await res.json()).pokemon;
        }));
        setPokemon(detailedPokemon);
        setTotalPokemon(data.count);
      } else {
        const response = await fetch(`${API_BASE}/pokemon?limit=${ITEMS_PER_PAGE}&offset=${offset}`, { headers: { 'X-API-KEY': X_KEY } });
        data = await response.json();
        detailedPokemon = await Promise.all(data.results.map(async (p: any) => {
          const res = await fetch(`${API_BASE}/pokemon/${p.name}`, { headers: { 'X-API-KEY': X_KEY } });
          return (await res.json()).pokemon;
        }));
        setPokemon(detailedPokemon);
        setTotalPokemon(data.total);
      }
    } catch (error) {
      console.error('Error fetching pokemon:', error);
      Alert.alert('Error', 'Failed to fetch Pokémon');
    }
    setLoading(false);
  };

  const toggleFavorite = async (poke: Pokemon) => {
    if (!user) return Alert.alert('Error', 'You must be logged in');
    const isFavorited = favoriteIds.includes(poke.pokeId);
    const prevFavorites = [...favorites];
    const prevIds = [...favoriteIds];

    try {
      if (isFavorited) {
        const updated = favorites.filter((f) => f.pokeId !== poke.pokeId);
        setFavorites(updated);
        setFavoriteIds(updated.map((p) => p.pokeId));
        const response = await fetch(`${API_BASE}/users/${user.uid}/pokemon-favorites/${poke.pokeId}`, {
          method: 'DELETE',
          headers: { 'X-API-KEY': X_KEY }
        });
        if (!response.ok) throw new Error('Failed to remove from favorites');
        if (filterType === 'favorites') fetchPokemon(currentPage, searchQuery, filterType);
      } else {
        const response = await fetch(`${API_BASE}/users/${user.uid}/pokemon-favorites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-KEY': X_KEY },
          body: JSON.stringify({ id: poke.pokeId }),
        });
        if (!response.ok) {
          if (response.status === 409) return fetchFavorites(user.uid);
          throw new Error('Failed to add to favorites');
        }
        const data = await response.json();
        const updated = [...favorites, data.favorite || poke];
        setFavorites(updated);
        setFavoriteIds(updated.map((p) => p.pokeId));
      }
    } catch (error: any) {
      setFavorites(prevFavorites);
      setFavoriteIds(prevIds);
      Alert.alert('Error', error.message);
    }
  };

  useEffect(() => {
    if (user) {
      fetchFavorites(user.uid).then(() => fetchPokemon(0, '', 'all'));
    }
  }, [user]);

  useEffect(() => {
    if (user && totalPokemon > 0) fetchPokemon(currentPage, searchQuery, filterType);
  }, [currentPage]);

  if (authLoading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#e74c3c" />
    </View>
  );
  if (!user) return <Redirect href="/auth" />;

  const totalPages = Math.ceil(totalPokemon / ITEMS_PER_PAGE);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Pokédex</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search Pokémon..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => { setCurrentPage(0); fetchPokemon(0, searchQuery, filterType); }}
        />
        <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilterModal(true)}>
          <Text style={styles.filterButtonText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterInfo}>
        <Text style={styles.filterInfoText}>
          {filterType === 'all' ? 'All' : filterType === 'favorites' ? `Favorites (${favorites.length})` : filterType.charAt(0).toUpperCase() + filterType.slice(1)}
        </Text>
        <TouchableOpacity onPress={() => { setCurrentPage(0); fetchPokemon(0, searchQuery, filterType); }} style={styles.searchButton}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.gridContainer}>
        <TouchableOpacity
          style={[styles.navButton, currentPage === 0 && styles.navButtonDisabled]}
          onPress={() => setCurrentPage(currentPage - 1)}
          disabled={currentPage === 0}>
          <Text style={styles.navButtonText}>◀</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator size="large" color="#e74c3c" />
          </View>
        ) : (
          <FlatList
            data={pokemon}
            numColumns={numColumns}
            key={numColumns}
            contentContainerStyle={styles.flatList}
            ListEmptyComponent={<Text style={styles.noResults}>{filterType === 'favorites' ? 'No favorites yet' : 'No Pokémon found'}</Text>}
            renderItem={({ item: poke }) => (
              <TouchableOpacity style={styles.pokemonTile} onPress={() => setSelectedPokemon(poke)}>
                <View style={styles.tileHeader}>
                  <Text style={styles.entryNumber}>#{poke.pokeId}</Text>
                  <TouchableOpacity onPress={() => toggleFavorite(poke)}>
                    <Text style={styles.star}>{favoriteIds.includes(poke.pokeId) ? '⭐' : '☆'}</Text>
                  </TouchableOpacity>
                </View>
                <Image source={{ uri: poke.sprite }} style={styles.sprite} />
                <Text style={styles.pokemonName} numberOfLines={1}>{poke.name}</Text>
              </TouchableOpacity>
            )}
          />
        )}

        <TouchableOpacity
          style={[styles.navButton, currentPage >= totalPages - 1 && styles.navButtonDisabled]}
          onPress={() => setCurrentPage(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}>
          <Text style={styles.navButtonText}>▶</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={!!selectedPokemon} transparent animationType="slide" onRequestClose={() => setSelectedPokemon(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedPokemon(null)}>
          <TouchableOpacity style={styles.modalContent} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedPokemon(null)}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
            {selectedPokemon && (
              <ScrollView>
                <Text style={styles.detailTitle}>#{selectedPokemon.pokeId} - {selectedPokemon.name}</Text>
                <Image source={{ uri: selectedPokemon.sprite }} style={styles.detailSprite} />
                <Text style={styles.detailLabel}>Types: <Text style={styles.detailText}>{selectedPokemon.types?.join(', ')}</Text></Text>
                <Text style={styles.detailLabel}>Height: <Text style={styles.detailText}>{selectedPokemon.height} dm</Text></Text>
                <Text style={styles.detailLabel}>Weight: <Text style={styles.detailText}>{selectedPokemon.weight} hg</Text></Text>
                <Text style={styles.detailLabel}>Abilities: <Text style={styles.detailText}>{selectedPokemon.abilities?.map(a => a.name).join(', ')}</Text></Text>
                <Text style={styles.detailLabel}>Stats:</Text>
                {selectedPokemon.stats?.map((stat, i) => (
                  <Text key={i} style={styles.statText}>{stat.name}: {stat.baseStat}</Text>
                ))}
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showFilterModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.filterModal}>
            <Text style={styles.modalTitle}>Select Filter</Text>
            {(['all', 'name', 'type', 'number', 'favorites'] as const).map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[styles.filterOption, filterType === filter && styles.filterOptionSelected]}
                onPress={() => {
                  setFilterType(filter);
                  setShowFilterModal(false);
                  setSearchQuery('');
                  setCurrentPage(0);
                  if (filter === 'all') fetchPokemon(0, '', filter);
                  else if (filter === 'favorites') fetchFavorites(user!.uid).then(() => fetchPokemon(0, '', filter));
                }}>
                <Text style={[styles.filterOptionText, filterType === filter && styles.filterOptionTextSelected]}>
                  {filter === 'all' ? 'All Pokémon' : filter === 'favorites' ? 'My Favorites' : `Search by ${filter.charAt(0).toUpperCase() + filter.slice(1)}`}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowFilterModal(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50, backgroundColor: '#e74c3c' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  userEmail: { fontSize: 12, color: '#fff', opacity: 0.8, marginTop: 2 },
  logoutButton: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 6 },
  logoutText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  searchContainer: { flexDirection: 'row', padding: 15, gap: 10 },
  searchInput: { flex: 1, borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, backgroundColor: '#fff' },
  filterButton: { width: 50, backgroundColor: '#3498db', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  filterButtonText: { fontSize: 20 },
  filterInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingBottom: 10 },
  filterInfoText: { color: '#666', fontSize: 14 },
  searchButton: { backgroundColor: '#2ecc71', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 6 },
  searchButtonText: { color: '#fff', fontWeight: 'bold' },
  gridContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10 },
  navButton: { width: 40, height: 40, backgroundColor: '#3498db', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  navButtonDisabled: { backgroundColor: '#bdc3c7' },
  navButtonText: { color: '#fff', fontSize: 20 },
  flatList: { padding: 5 },
  pokemonTile: { width: TILE_SIZE, margin: TILE_MARGIN, backgroundColor: '#fff', borderRadius: 8, padding: 8, borderWidth: 2, borderColor: '#ddd' },
  tileHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  entryNumber: { fontSize: 12, fontWeight: 'bold', color: '#666' },
  star: { fontSize: 18 },
  sprite: { width: 80, height: 80, resizeMode: 'contain' },
  pokemonName: { fontSize: 12, textAlign: 'center', color: '#333', textTransform: 'capitalize', marginTop: 2 },
  noResults: { textAlign: 'center', color: '#999', fontSize: 16, padding: 50 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  closeButton: { position: 'absolute', top: 10, right: 15, zIndex: 1, padding: 5 },
  closeButtonText: { fontSize: 36, color: '#666' },
  detailTitle: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 15, color: '#e74c3c', textTransform: 'capitalize' },
  detailSprite: { width: 150, height: 150, resizeMode: 'contain', alignSelf: 'center', marginBottom: 20 },
  detailLabel: { fontSize: 16, fontWeight: 'bold', color: '#333', marginTop: 10 },
  detailText: { fontSize: 14, color: '#666', fontWeight: 'normal', textTransform: 'capitalize' },
  statText: { fontSize: 14, color: '#666', marginLeft: 10, textTransform: 'capitalize' },
  filterModal: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '80%', maxWidth: 400 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: '#333' },
  filterOption: { padding: 15, borderRadius: 8, marginBottom: 10, backgroundColor: '#f5f5f5' },
  filterOptionSelected: { backgroundColor: '#e74c3c' },
  filterOptionText: { fontSize: 16, textAlign: 'center', color: '#333' },
  filterOptionTextSelected: { color: '#fff' },
  modalCloseButton: { marginTop: 10, padding: 15, backgroundColor: '#95a5a6', borderRadius: 8 },
  modalCloseText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' },
});