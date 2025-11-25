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

const TILE_SIZE = 170;
const TILE_MARGIN = 12;
const ITEMS_PER_PAGE = 20;

const TYPE_COLORS: Record<string, string> = {
  normal: '#A8A77A',
  fire: '#EE8130',
  water: '#6390F0',
  electric: '#F7D02C',
  grass: '#7AC74C',
  ice: '#96D9D6',
  fighting: '#C22E28',
  poison: '#A33EA1',
  ground: '#E2BF65',
  flying: '#A98FF3',
  psychic: '#F95587',
  bug: '#A6B91A',
  rock: '#B6A136',
  ghost: '#735797',
  dragon: '#6F35FC',
  dark: '#705746',
  steel: '#B7B7CE',
  fairy: '#D685AD',
};

const TYPE_WEAKNESSES: Record<string, string[]> = {
  normal: ['fighting'],
  fire: ['water', 'rock', 'ground'],
  water: ['electric', 'grass'],
  electric: ['ground'],
  grass: ['fire', 'ice', 'poison', 'flying', 'bug'],
  ice: ['fire', 'fighting', 'rock', 'steel'],
  fighting: ['flying', 'psychic', 'fairy'],
  poison: ['ground', 'psychic'],
  ground: ['water', 'grass', 'ice'],
  flying: ['electric', 'ice', 'rock'],
  psychic: ['bug', 'ghost', 'dark'],
  bug: ['fire', 'flying', 'rock'],
  rock: ['water', 'grass', 'fighting', 'ground', 'steel'],
  ghost: ['ghost', 'dark'],
  dragon: ['ice', 'dragon', 'fairy'],
  dark: ['fighting', 'bug', 'fairy'],
  steel: ['fire', 'fighting', 'ground'],
  fairy: ['poison', 'steel'],
};

const getTypeColor = (type?: string) => {
  if (!type) return '#ccc';
  return TYPE_COLORS[type.toLowerCase()] || '#ccc';
};

const getWeaknesses = (types: string[] = []) => {
  const set = new Set<string>();
  types.forEach((t) => {
    TYPE_WEAKNESSES[t.toLowerCase()]?.forEach((weak) => set.add(weak));
  });
  return Array.from(set).slice(0, 4);
};

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
  const [contentSpacing, setContentSpacing] = useState({ top: 400, bottom: 10 });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const updateColumns = () => {
      const screenWidth = Dimensions.get('window').width;
      const adjustedWidth = screenWidth - 100; // Subtract nav buttons
      setNumColumns(Math.max(1, Math.floor(adjustedWidth / (TILE_SIZE + TILE_MARGIN * 2))));

      const topOffset = screenWidth >= 1200 ? 380 : screenWidth >= 900 ? 300 : screenWidth >= 600 ? 220 : 140;
      const bottomPadding = screenWidth >= 900 ? 20 : 50;
      setContentSpacing({ top: topOffset, bottom: bottomPadding });
      setIsMobile(screenWidth < 600);
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
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
        <View>
          <Text style={styles.headerTitle}>Pokédex</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

        <View style={styles.searchBar}>
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

        <View style={styles.filterInfoRow}>
        <Text style={styles.filterInfoText}>
          {filterType === 'all' ? 'All' : filterType === 'favorites' ? `Favorites (${favorites.length})` : filterType.charAt(0).toUpperCase() + filterType.slice(1)}
        </Text>
          <TouchableOpacity
            onPress={() => { setCurrentPage(0); fetchPokemon(0, searchQuery, filterType); }}
            style={styles.searchButton}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.appContent,
          { paddingTop: contentSpacing.top, paddingBottom: contentSpacing.bottom },
        ]}>
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
              columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
            ListEmptyComponent={<Text style={styles.noResults}>{filterType === 'favorites' ? 'No favorites yet' : 'No Pokémon found'}</Text>}
            renderItem={({ item: poke }) => {
              const primaryType = poke.types?.[0] || 'normal';
              const typeColor = getTypeColor(primaryType);
              return (
                <TouchableOpacity 
                  style={[
                    styles.pokemonTile, 
                    { 
                      backgroundColor: `${typeColor}15`, 
                      borderColor: `${typeColor}50` 
                    }
                  ]} 
                  onPress={() => setSelectedPokemon(poke)}>
                  <View style={styles.tileHeader}>
                    <Text style={styles.entryNumber}>#{poke.pokeId}</Text>
                    <TouchableOpacity onPress={() => toggleFavorite(poke)}>
                      <Text style={styles.star}>{favoriteIds.includes(poke.pokeId) ? '⭐' : '☆'}</Text>
                    </TouchableOpacity>
                  </View>
                  <Image source={{ uri: poke.sprite }} style={styles.sprite} />
                  <Text style={styles.pokemonName} numberOfLines={1}>{poke.name}</Text>
                </TouchableOpacity>
              );
            }}
          />
        )}

        <TouchableOpacity
          style={[styles.navButton, currentPage >= totalPages - 1 && styles.navButtonDisabled]}
          onPress={() => setCurrentPage(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}>
          <Text style={styles.navButtonText}>▶</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>

      <Modal visible={!!selectedPokemon} transparent animationType="fade" onRequestClose={() => setSelectedPokemon(null)}>
        <TouchableOpacity style={[styles.modalOverlay, isMobile && styles.modalOverlayMobile]} activeOpacity={1} onPress={() => setSelectedPokemon(null)}>
          <TouchableOpacity style={[styles.modalContent, isMobile && styles.modalContentMobile]} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <TouchableOpacity style={[styles.closeButton, isMobile && styles.closeButtonMobile]} onPress={() => setSelectedPokemon(null)}>
              <Text style={[styles.closeButtonText, isMobile && styles.closeButtonTextMobile]}>×</Text>
            </TouchableOpacity>
            {selectedPokemon && (
              <ScrollView contentContainerStyle={[styles.detailScroll, isMobile && styles.detailScrollMobile]}>
                <View style={[styles.detailCard, isMobile && styles.detailCardMobile]}>
                  <View style={styles.detailMedia}>
                    <View style={[styles.detailCircle, isMobile && styles.detailCircleMobile, { backgroundColor: `${getTypeColor(selectedPokemon.types?.[0])}22` }]}>
                      <Image source={{ uri: selectedPokemon.sprite }} style={[styles.detailSprite, isMobile && styles.detailSpriteMobile]} />
                    </View>
                  </View>
                  <View style={[styles.detailInfo, isMobile && styles.detailInfoMobile]}>
                    <View style={styles.detailHeaderRow}>
                      <View>
                        <Text style={[styles.detailName, isMobile && styles.detailNameMobile]}>{selectedPokemon.name}</Text>
                        <Text style={[styles.detailTypeLabel, isMobile && styles.detailTypeLabelMobile]}>
                          {selectedPokemon.types?.[0] || 'unknown'}
                        </Text>
                      </View>
                      <Text style={[styles.detailId, isMobile && styles.detailIdMobile]}>#{selectedPokemon.pokeId}</Text>
                    </View>

                    <View style={styles.typeChipRow}>
                      {selectedPokemon.types?.map((type) => (
                        <Text key={type} style={[styles.typeChip, isMobile && styles.typeChipMobile, { backgroundColor: getTypeColor(type) }]}>
                          {type}
                        </Text>
                      ))}
                    </View>

                    <Text style={[styles.detailDescription, isMobile && styles.detailDescriptionMobile]}>
                      {selectedPokemon.abilities?.length
                        ? `Famous for abilities like ${selectedPokemon.abilities.map((a) => a.name).join(', ')}.`
                        : 'A mysterious Pokémon with undiscovered traits.'}
                    </Text>

                    <View style={[styles.detailStatsGrid, isMobile && styles.detailStatsGridMobile]}>
                      <View style={[styles.statCard, isMobile && styles.statCardMobile]}>
                        <Text style={[styles.statLabel, isMobile && styles.statLabelMobile]}>Height</Text>
                        <Text style={[styles.statValue, isMobile && styles.statValueMobile]}>{(selectedPokemon.height / 10).toFixed(1)} m</Text>
                      </View>
                      <View style={[styles.statCard, isMobile && styles.statCardMobile]}>
                        <Text style={[styles.statLabel, isMobile && styles.statLabelMobile]}>Weight</Text>
                        <Text style={[styles.statValue, isMobile && styles.statValueMobile]}>{(selectedPokemon.weight / 10).toFixed(1)} kg</Text>
                      </View>
                      <View style={[styles.statCard, isMobile && styles.statCardMobile]}>
                        <Text style={[styles.statLabel, isMobile && styles.statLabelMobile]}>Base EXP</Text>
                        <Text style={[styles.statValue, isMobile && styles.statValueMobile]}>
                          {selectedPokemon.stats?.reduce((sum, stat) => sum + stat.baseStat, 0)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.weaknessSection}>
                      <Text style={[styles.weaknessTitle, isMobile && styles.weaknessTitleMobile]}>Weaknesses</Text>
                      <View style={styles.weaknessChips}>
                        {getWeaknesses(selectedPokemon.types || []).map((weak) => (
                          <Text key={weak} style={[styles.weaknessChip, isMobile && styles.weaknessChipMobile, { backgroundColor: `${getTypeColor(weak)}33` }]}>
                            {weak}
                          </Text>
                        ))}
                        {!getWeaknesses(selectedPokemon.types || []).length && (
                          <Text style={styles.detailText}>Data unavailable</Text>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
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
  appContent: {
    flexGrow: 1,
    paddingHorizontal: 10,
  },
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: 'PressStart2P_400Regular', fontSize: 24, color: '#fff' },
  heroCard: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  filterInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
  },
  userEmail: { fontFamily: 'PressStart2P_400Regular', fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 6 },
  logoutButton: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 6 },
  logoutText: { fontFamily: 'PressStart2P_400Regular', color: '#fff', fontSize: 12 },
  searchInput: { fontFamily: 'PressStart2P_400Regular', flex: 1, fontSize: 12, color: '#333' },
  filterButton: { width: 44, height: 44, backgroundColor: '#3498db', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  filterButtonText: { fontFamily: 'PressStart2P_400Regular', fontSize: 18, color: '#fff' },
  filterInfoText: { fontFamily: 'PressStart2P_400Regular', color: '#fff', fontSize: 12 },
  searchButton: { backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  searchButtonText: { fontFamily: 'PressStart2P_400Regular', color: '#e74c3c', fontSize: 12 },
  gridContainer: {
    flex: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  navButton: { width: 40, height: 40, backgroundColor: '#3498db', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  navButtonDisabled: { backgroundColor: '#bdc3c7' },
  navButtonText: { fontFamily: 'PressStart2P_400Regular', color: '#fff', fontSize: 16 },
  flatList: { paddingHorizontal: 10, paddingVertical: 10 },
  columnWrapper: { justifyContent: 'flex-start' },
  pokemonTile: {
    width: TILE_SIZE,
    margin: TILE_MARGIN,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: '#ececec',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  tileHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  entryNumber: { fontFamily: 'PressStart2P_400Regular', fontSize: 10, color: '#666' },
  star: { fontFamily: 'PressStart2P_400Regular', fontSize: 18 },
  sprite: { width: 120, height: 120, resizeMode: 'contain', alignSelf: 'center' },
  pokemonName: { fontFamily: 'PressStart2P_400Regular', fontSize: 12, textAlign: 'center', color: '#333', textTransform: 'capitalize', marginTop: 10 },
  noResults: { fontFamily: 'PressStart2P_400Regular', textAlign: 'center', color: '#999', fontSize: 14, padding: 50 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 },
  modalOverlayMobile: { paddingHorizontal: 10 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: '95%', width: '90%', maxWidth: 900, alignSelf: 'center' },
  modalContentMobile: { padding: 16, width: '98%', maxHeight: '95%' },
  closeButton: { position: 'absolute', top: 8, right: 12, zIndex: 1, padding: 4 },
  closeButtonMobile: { top: 8, right: 12, padding: 4 },
  closeButtonText: { fontSize: 32, color: '#666' },
  closeButtonTextMobile: { fontSize: 28 },
  detailScroll: { padding: 12 },
  detailScrollMobile: { padding: 8 },
  detailCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    gap: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 6,
  },
  detailCardMobile: {
    flexDirection: 'column',
    padding: 16,
    gap: 16,
  },
  detailMedia: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  detailCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCircleMobile: {
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  detailSprite: { width: 180, height: 180, resizeMode: 'contain' },
  detailSpriteMobile: { width: 120, height: 120 },
  detailInfo: { flex: 1.3, justifyContent: 'center' },
  detailInfoMobile: { flex: 0, width: '100%' },
  detailHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  detailName: { fontFamily: 'PressStart2P_400Regular', fontSize: 16, color: '#222', textTransform: 'uppercase' },
  detailNameMobile: { fontSize: 14 },
  detailTypeLabel: { fontFamily: 'PressStart2P_400Regular', fontSize: 11, color: '#777', marginTop: 4, textTransform: 'capitalize' },
  detailTypeLabelMobile: { fontSize: 10 },
  detailId: { fontFamily: 'PressStart2P_400Regular', fontSize: 14, color: '#bbb' },
  detailIdMobile: { fontSize: 12 },
  typeChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  typeChip: {
    fontFamily: 'PressStart2P_400Regular',
    color: '#fff',
    fontSize: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    textTransform: 'capitalize',
  },
  typeChipMobile: {
    fontSize: 9,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  detailDescription: { fontFamily: 'PressStart2P_400Regular', fontSize: 10, color: '#555', lineHeight: 16, marginBottom: 12 },
  detailDescriptionMobile: { fontSize: 9, lineHeight: 14, marginBottom: 12 },
  detailStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  detailStatsGridMobile: { gap: 8, marginBottom: 12 },
  statCard: {
    flexGrow: 1,
    minWidth: 90,
    backgroundColor: '#f7f7f7',
    padding: 10,
    borderRadius: 12,
  },
  statCardMobile: {
    minWidth: 80,
    padding: 10,
    borderRadius: 12,
  },
  statLabel: { fontFamily: 'PressStart2P_400Regular', fontSize: 9, color: '#999', marginBottom: 4, textTransform: 'uppercase' },
  statLabelMobile: { fontSize: 8, marginBottom: 4 },
  statValue: { fontFamily: 'PressStart2P_400Regular', fontSize: 12, color: '#222' },
  statValueMobile: { fontSize: 12 },
  weaknessSection: { marginTop: 4 },
  weaknessTitle: { fontFamily: 'PressStart2P_400Regular', fontSize: 11, color: '#222', marginBottom: 6 },
  weaknessTitleMobile: { fontSize: 10, marginBottom: 6 },
  weaknessChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  weaknessChip: {
    fontFamily: 'PressStart2P_400Regular',
    color: '#333',
    fontSize: 10,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 10,
    textTransform: 'capitalize',
  },
  weaknessChipMobile: {
    fontSize: 9,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  detailText: { fontFamily: 'PressStart2P_400Regular', fontSize: 11, color: '#666', textTransform: 'capitalize' },
  filterModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  modalTitle: { fontFamily: 'PressStart2P_400Regular', fontSize: 16, textAlign: 'center', marginBottom: 20, color: '#333' },
  filterOption: { padding: 15, borderRadius: 8, marginBottom: 10, backgroundColor: '#f5f5f5' },
  filterOptionSelected: { backgroundColor: '#e74c3c' },
  filterOptionText: { fontFamily: 'PressStart2P_400Regular', fontSize: 12, textAlign: 'center', color: '#333' },
  filterOptionTextSelected: { color: '#fff' },
  modalCloseButton: { marginTop: 10, padding: 15, backgroundColor: '#95a5a6', borderRadius: 8 },
  modalCloseText: { fontFamily: 'PressStart2P_400Regular', color: '#fff', textAlign: 'center', fontSize: 12 },
});