import { API_BASE } from '@/config/api';
import { useAuth } from '@/context/AuthContext';
import { Redirect, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
}

export default function PokedexScreen() {
  const { user, signOut, loading: authLoading } = useAuth();
  const router = useRouter();

  // Main app state
  const [pokemon, setPokemon] = useState<Pokemon[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedPokemon, setSelectedPokemon] = useState<Pokemon | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'name' | 'type' | 'number' | 'favorites'>(
    'all'
  );
  const [favorites, setFavorites] = useState<Pokemon[]>([]);
  const [totalPokemon, setTotalPokemon] = useState(0);
  const [loadingPokemon, setLoadingPokemon] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const ITEMS_PER_PAGE = 5;

  // Redirect to auth if not logged in
  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e74c3c" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/auth" />;
  }

  // Fetch user favorites
  const fetchFavorites = async (firebaseUid: string) => {
    try {
      const response = await fetch(`${API_BASE}/users/${firebaseUid}/pokemon-favorites`);
      if (response.ok) {
        const data = await response.json();
        setFavorites(data.pokemonFavorites || []);
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  };

  // Fetch pokemon based on filter and page
  const fetchPokemon = async (page = 0, search = '', filter: string = 'all') => {
    setLoadingPokemon(true);
    try {
      const offset = page * ITEMS_PER_PAGE;

      if (filter === 'favorites') {
        const start = offset;
        const end = start + ITEMS_PER_PAGE;
        setPokemon(favorites.slice(start, end));
        setTotalPokemon(favorites.length);
      } else if (filter === 'type' && search) {
        const response = await fetch(`${API_BASE}/pokemon/type/${search.toLowerCase()}`);
        const data = await response.json();
        const start = offset;
        const end = start + ITEMS_PER_PAGE;

        const pokemonSlice = data.results.slice(start, end);
        const detailedPokemon = await Promise.all(
          pokemonSlice.map(async (p: any) => {
            const detailResponse = await fetch(`${API_BASE}/pokemon/${p.name}`);
            const detailData = await detailResponse.json();
            return detailData.pokemon;
          })
        );

        setPokemon(detailedPokemon);
        setTotalPokemon(data.count);
      } else if (filter === 'number' && search) {
        const response = await fetch(`${API_BASE}/pokemon/${search}`);
        const data = await response.json();
        setPokemon([data.pokemon]);
        setTotalPokemon(1);
      } else if (filter === 'name' && search) {
        try {
          const response = await fetch(`${API_BASE}/pokemon/${search.toLowerCase()}`);
          if (response.ok) {
            const data = await response.json();
            setPokemon([data.pokemon]);
            setTotalPokemon(1);
          } else {
            throw new Error('Not found');
          }
        } catch {
          const response = await fetch(`${API_BASE}/pokemon/search/${search.toLowerCase()}`);
          const data = await response.json();
          const start = offset;
          const end = start + ITEMS_PER_PAGE;

          const pokemonSlice = data.results.slice(start, end);
          const detailedPokemon = await Promise.all(
            pokemonSlice.map(async (p: any) => {
              const detailResponse = await fetch(`${API_BASE}/pokemon/${p.name}`);
              const detailData = await detailResponse.json();
              return detailData.pokemon;
            })
          );

          setPokemon(detailedPokemon);
          setTotalPokemon(data.count);
        }
      } else {
        const response = await fetch(`${API_BASE}/pokemon?limit=${ITEMS_PER_PAGE}&offset=${offset}`);
        const data = await response.json();

        const detailedPokemon = await Promise.all(
          data.results.map(async (p: any) => {
            const detailResponse = await fetch(`${API_BASE}/pokemon/${p.name}`);
            const detailData = await detailResponse.json();
            return detailData.pokemon;
          })
        );

        setPokemon(detailedPokemon);
        setTotalPokemon(data.total);
      }
    } catch (error) {
      console.error('Error fetching pokemon:', error);
      setPokemon([]);
      setTotalPokemon(0);
      Alert.alert('Error', 'Failed to fetch Pokémon. Check your backend connection.');
    }
    setLoadingPokemon(false);
  };

  // Toggle favorite
  const toggleFavorite = async (poke: Pokemon) => {
    if (!user) return;

    const isFavorited = favorites.some((f) => f.pokeId === poke.pokeId);

    try {
      if (isFavorited) {
        await fetch(`${API_BASE}/users/${user.uid}/pokemon-favorites/${poke.pokeId}`, {
          method: 'DELETE',
        });
        setFavorites(favorites.filter((f) => f.pokeId !== poke.pokeId));
      } else {
        await fetch(`${API_BASE}/users/${user.uid}/pokemon-favorites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: poke.pokeId }),
        });
        setFavorites([...favorites, poke]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update favorites');
    }
  };

  // Handle search
  const handleSearch = () => {
    setCurrentPage(0);
    fetchPokemon(0, searchQuery, filterType);
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to logout');
    }
  };

  // Load pokemon when page changes
  useEffect(() => {
    if (user) {
      fetchPokemon(currentPage, searchQuery, filterType);
    }
  }, [currentPage]);

  // Initial load
  useEffect(() => {
    if (user) {
      fetchFavorites(user.uid);
      fetchPokemon(0, '', 'all');
    }
  }, [user]);

  const totalPages = Math.ceil(totalPokemon / ITEMS_PER_PAGE);
  const canGoPrev = currentPage > 0;
  const canGoNext = currentPage < totalPages - 1;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pokédex</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Search and Filter */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search Pokémon..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilterModal(true)}>
          <Text style={styles.filterButtonText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterInfo}>
        <Text style={styles.filterInfoText}>
          Filter:{' '}
          {filterType === 'all'
            ? 'All Pokémon'
            : filterType === 'name'
            ? 'Name'
            : filterType === 'type'
            ? 'Type'
            : filterType === 'number'
            ? 'Number'
            : 'Favorites'}
        </Text>
        <TouchableOpacity onPress={handleSearch} style={styles.searchButton}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Pokemon Grid */}
      <View style={styles.gridContainer}>
        <TouchableOpacity
          style={[styles.navButton, !canGoPrev && styles.navButtonDisabled]}
          onPress={() => canGoPrev && setCurrentPage(currentPage - 1)}
          disabled={!canGoPrev}>
          <Text style={styles.navButtonText}>◀</Text>
        </TouchableOpacity>

        <View style={styles.pokemonGrid}>
          {loadingPokemon ? (
            <ActivityIndicator size="large" color="#e74c3c" />
          ) : pokemon.length === 0 ? (
            <Text style={styles.noResults}>No Pokémon found</Text>
          ) : (
            pokemon.map((poke, index) => {
              const isFavorited = favorites.some((f) => f.pokeId === poke.pokeId);
              const isSelected = selectedPokemon?.pokeId === poke.pokeId;

              return (
                <TouchableOpacity
                  key={poke.pokeId || index}
                  style={[styles.pokemonTile, isSelected && styles.pokemonTileSelected]}
                  onPress={() => setSelectedPokemon(poke)}>
                  <View style={styles.tileHeader}>
                    <Text style={styles.entryNumber}>#{poke.pokeId}</Text>
                    <TouchableOpacity onPress={() => toggleFavorite(poke)}>
                      <Text style={styles.star}>{isFavorited ? '⭐' : '☆'}</Text>
                    </TouchableOpacity>
                  </View>
                  <Image
                    source={{ uri: poke.sprite || 'https://via.placeholder.com/96' }}
                    style={styles.sprite}
                  />
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <TouchableOpacity
          style={[styles.navButton, !canGoNext && styles.navButtonDisabled]}
          onPress={() => canGoNext && setCurrentPage(currentPage + 1)}
          disabled={!canGoNext}>
          <Text style={styles.navButtonText}>▶</Text>
        </TouchableOpacity>
      </View>

      {/* Pokemon Details */}
      {selectedPokemon && (
        <ScrollView style={styles.detailsContainer}>
          <Text style={styles.detailTitle}>
            #{selectedPokemon.pokeId} - {selectedPokemon.name}
          </Text>
          <Image source={{ uri: selectedPokemon.sprite }} style={styles.detailSprite} />

          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Types:</Text>
            <Text style={styles.detailText}>{selectedPokemon.types?.join(', ') || 'N/A'}</Text>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Height:</Text>
            <Text style={styles.detailText}>{selectedPokemon.height || 0} dm</Text>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Weight:</Text>
            <Text style={styles.detailText}>{selectedPokemon.weight || 0} hg</Text>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Abilities:</Text>
            <Text style={styles.detailText}>
              {selectedPokemon.abilities?.map((a) => a.name).join(', ') || 'N/A'}
            </Text>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Stats:</Text>
            {selectedPokemon.stats?.map((stat, i) => (
              <Text key={i} style={styles.statText}>
                {stat.name}: {stat.baseStat}
              </Text>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Filter Modal */}
      <Modal visible={showFilterModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
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
                  if (filter === 'all' || filter === 'favorites') {
                    fetchPokemon(0, '', filter);
                  }
                }}>
                <Text
                  style={[
                    styles.filterOptionText,
                    filterType === filter && styles.filterOptionTextSelected,
                  ]}>
                  {filter === 'all'
                    ? 'All Pokémon'
                    : filter === 'name'
                    ? 'Search by Name'
                    : filter === 'type'
                    ? 'Search by Type'
                    : filter === 'number'
                    ? 'Search by Number'
                    : 'My Favorites'}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowFilterModal(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#e74c3c',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  logoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  filterButton: {
    width: 50,
    backgroundColor: '#3498db',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonText: {
    fontSize: 20,
  },
  filterInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  filterInfoText: {
    color: '#666',
    fontSize: 14,
  },
  searchButton: {
    backgroundColor: '#2ecc71',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  gridContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 10,
  },
  navButton: {
    width: 40,
    height: 40,
    backgroundColor: '#3498db',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  navButtonText: {
    color: '#fff',
    fontSize: 20,
  },
  pokemonGrid: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 150,
    justifyContent: 'flex-start',
  },
  pokemonTile: {
    width: 100,
    height: 130,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  pokemonTileSelected: {
    borderColor: '#e74c3c',
    borderWidth: 3,
  },
  tileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  entryNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
  },
  star: {
    fontSize: 18,
  },
  sprite: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
  },
  noResults: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    padding: 20,
  },
  detailsContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    margin: 15,
    borderRadius: 12,
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    color: '#e74c3c',
    textTransform: 'capitalize',
  },
  detailSprite: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    alignSelf: 'center',
    marginBottom: 20,
  },
  detailSection: {
    marginBottom: 15,
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    textTransform: 'capitalize',
  },
  statText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
    textTransform: 'capitalize',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  filterOption: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#f5f5f5',
  },
  filterOptionSelected: {
    backgroundColor: '#e74c3c',
  },
  filterOptionText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
  },
  filterOptionTextSelected: {
    color: '#fff',
  },
  modalCloseButton: {
    marginTop: 10,
    padding: 15,
    backgroundColor: '#95a5a6',
    borderRadius: 8,
  },
  modalCloseText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});