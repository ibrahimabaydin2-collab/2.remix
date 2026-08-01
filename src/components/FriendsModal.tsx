import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  UserPlus, 
  UserMinus, 
  Search, 
  X, 
  Copy, 
  Check, 
  Swords, 
  CheckCircle, 
  AlertCircle,
  RefreshCw,
  Sparkles,
  Shield,
  UserCheck
} from 'lucide-react';
import { getDeckRandomLength } from '../data/wordlist';
import { UserProfile, FriendRequest, isImageUrl } from '../types';
import UserAvatar from './UserAvatar';
import { 
  sendFriendRequestInFirestore, 
  acceptFriendRequestInFirestore, 
  removeFriendInFirestore, 
  fetchFriendRequestsAndSync, 
  searchUserByName, 
  fetchUserProfile 
} from '../lib/firebase';

interface FriendsModalProps {
  profile: UserProfile;
  onClose: () => void;
  onUpdateFriends: (newFriends: string[]) => void;
  isOnline: boolean;
  lobbyPlayers?: any[];
  onChallengePlayer?: (player: UserProfile, wordLength?: number) => void;
  isChallengePending?: boolean;
  wordLength?: number;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function FriendsModal({
  profile,
  onClose,
  onUpdateFriends,
  isOnline,
  lobbyPlayers = [],
  onChallengePlayer,
  isChallengePending = false,
  wordLength = 5,
  showToast
}: FriendsModalProps) {
  const [activeTab, setActiveTab] = useState<'friends' | 'add' | 'requests'>('friends');
  
  // Friends data state
  const [confirmedFriends, setConfirmedFriends] = useState<UserProfile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Search state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searching, setSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searchDone, setSearchDone] = useState<boolean>(false);

  // Actions tracking state
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  // Helper to check real-time online status
  const isFriendOnline = (friend: { id: string; isOnline?: boolean; lastSeen?: number | string }) => {
    if (!isOnline) return false;
    if (lobbyPlayers && Array.isArray(lobbyPlayers)) {
      const found = lobbyPlayers.some(lp => lp.id === friend.id || String(lp.id) === String(friend.id));
      if (found) return true;
    }
    if (friend.isOnline === true) return true;
    if (friend.lastSeen) {
      const lastSeenMs = typeof friend.lastSeen === 'number' ? friend.lastSeen : new Date(friend.lastSeen).getTime();
      if (!isNaN(lastSeenMs) && (Date.now() - lastSeenMs) < 180000) return true;
    }
    return false;
  };

  // Refs to avoid unnecessary re-creation of callbacks and infinite loops
  const onUpdateFriendsRef = React.useRef(onUpdateFriends);
  useEffect(() => {
    onUpdateFriendsRef.current = onUpdateFriends;
  }, [onUpdateFriends]);

  const profileFriendsRef = React.useRef(profile?.friends || []);
  useEffect(() => {
    profileFriendsRef.current = profile?.friends || [];
  }, [profile?.friends]);

  // Load and synchronize friends & requests from Firestore
  const refreshFriends = useCallback(async (isSilent = false, overrideProfile?: UserProfile) => {
    const activeProfile = overrideProfile || profile;
    if (!activeProfile?.id) return;
    if (!isSilent && confirmedFriends.length === 0) setLoading(true);
    setRefreshing(true);

    try {
      const data = await fetchFriendRequestsAndSync(activeProfile);
      setConfirmedFriends(data.confirmedFriends || []);
      setIncomingRequests(data.incomingRequests || []);

      if (data.updatedFriendsArray && Array.isArray(data.updatedFriendsArray)) {
        const current = profileFriendsRef.current;
        const isDifferent =
          data.updatedFriendsArray.length !== current.length ||
          data.updatedFriendsArray.some((id, idx) => id !== current[idx]);

        if (isDifferent && onUpdateFriendsRef.current) {
          onUpdateFriendsRef.current(data.updatedFriendsArray);
        }
      }
    } catch (err) {
      console.warn('Error fetching friends list:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, confirmedFriends.length]);

  useEffect(() => {
    refreshFriends(false);
  }, [profile?.id]);

  // Execute search by Username
  const handleSearch = async () => {
    const term = searchTerm.trim();
    if (!term) return;

    setSearching(true);
    setSearchDone(true);
    setSearchResults([]);

    try {
      const resultsMap = new Map<string, UserProfile>();

      // Search by username / display name
      const nameResults = await searchUserByName(term);
      nameResults.forEach(u => {
        if (u.id && u.id !== profile.id) {
          resultsMap.set(u.id, u);
        }
      });

      setSearchResults(Array.from(resultsMap.values()));
    } catch (err) {
      console.warn('Friend search error:', err);
      if (showToast) showToast('Arama sırasında bir hata oluştu.', 'error');
    } finally {
      setSearching(false);
    }
  };

  // Send Friend Request
  const handleAddFriend = async (targetUser: UserProfile) => {
    if (!profile?.id || !targetUser?.id) return;
    setPendingActionId(targetUser.id);

    try {
      await sendFriendRequestInFirestore(profile, targetUser.id);
      setSentRequests(prev => new Set(prev).add(targetUser.id));
      if (showToast) showToast(`${targetUser.name || 'Oyuncuya'} arkadaşlık isteği gönderildi!`, 'success');
      await refreshFriends(true);
    } catch (err) {
      console.warn('Failed to send friend request:', err);
      if (showToast) showToast('İstek gönderilemedi.', 'error');
    } finally {
      setPendingActionId(null);
    }
  };

  // Accept Friend Request
  const handleAcceptRequest = async (requestUser: UserProfile) => {
    if (!profile?.id || !requestUser?.id) return;
    setPendingActionId(requestUser.id);

    try {
      await acceptFriendRequestInFirestore(profile.id, requestUser.id);
      if (showToast) showToast(`${requestUser.name || 'Oyuncu'} ile arkadaş olundu!`, 'success');
      await refreshFriends(true);
    } catch (err) {
      console.warn('Failed to accept friend request:', err);
      if (showToast) showToast('İstek kabul edilemedi.', 'error');
    } finally {
      setPendingActionId(null);
    }
  };

  // Remove Friend
  const handleRemoveFriend = async (friendUser: UserProfile) => {
    if (!profile?.id || !friendUser?.id) return;
    
    if (!window.confirm(`${friendUser.name || 'Bu oyuncuyu'} arkadaş listenden çıkarmak istediğine emin misin?`)) {
      return;
    }

    setPendingActionId(friendUser.id);
    const previousFriends = [...confirmedFriends];

    try {
      // 1. Remove relationship in Firestore
      await removeFriendInFirestore(profile.id, friendUser.id);
      
      // 2. Instant optimistic UI state update
      const updatedList = confirmedFriends.filter(f => f.id !== friendUser.id);
      setConfirmedFriends(updatedList);
      
      const newFriendIds = updatedList.map(f => f.id);
      onUpdateFriends(newFriendIds);

      // 3. User feedback
      if (showToast) {
        showToast(`${friendUser.name || 'Oyuncu'} arkadaş listenden çıkarıldı.`, 'info');
      }

      // 4. Background re-sync using updated profile object
      const updatedProfile: UserProfile = {
        ...profile,
        friends: newFriendIds
      };
      await refreshFriends(true, updatedProfile);
    } catch (err) {
      console.error('Failed to remove friend:', err);
      // Rollback UI state on error
      setConfirmedFriends(previousFriends);
      onUpdateFriends(previousFriends.map(f => f.id));
      if (showToast) {
        showToast('Arkadaş silinirken bir hata oluştu.', 'error');
      }
    } finally {
      setPendingActionId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-fadeIn" id="friends-modal">
      <div className="w-full max-w-md bg-[#161D2B] border-2 border-amber-500/40 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4 text-left relative text-[#FAF6E9] animate-scaleUp max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-lg shrink-0">
              <Users size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-amber-300 tracking-wide uppercase flex items-center gap-2">
                Arkadaş Listesi
                <button
                  type="button"
                  onClick={() => refreshFriends(true)}
                  className="hover:opacity-80 transition cursor-pointer p-0.5 rounded"
                  title="Yenile"
                >
                  <RefreshCw size={13} className={`text-amber-400 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </h3>
              <p className="text-[11px] text-slate-400">Arkadaş ekle, davet et ve çevrimiçi durumlarını gör</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-full bg-slate-800 border border-slate-700 cursor-pointer transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selection Navigation */}
        <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-2 text-xs font-black uppercase rounded-xl transition-all text-center cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'friends'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users size={14} />
            <span>Arkadaşlar ({confirmedFriends.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('add')}
            className={`flex-1 py-2 text-xs font-black uppercase rounded-xl transition-all text-center cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'add'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus size={14} />
            <span>Arkadaş Ekle</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-2 text-xs font-black uppercase rounded-xl transition-all text-center cursor-pointer flex items-center justify-center gap-1.5 relative ${
              activeTab === 'requests'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles size={14} />
            <span>İstekler</span>
            {incomingRequests.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-extrabold flex items-center justify-center ml-1">
                {incomingRequests.length}
              </span>
            )}
          </button>
        </div>

        {/* Main Tab Content */}
        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-3 min-h-[220px]">
          
          {/* TAB 1: FRIENDS LIST */}
          {activeTab === 'friends' && (
            <div>
              {loading ? (
                <div className="text-center py-10 text-slate-400">
                  <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs font-mono uppercase tracking-wider">Arkadaşlar Yükleniyor...</p>
                </div>
              ) : confirmedFriends.length === 0 ? (
                <div className="text-center py-10 px-4 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-2">
                  <p className="text-xs font-extrabold text-amber-300 uppercase tracking-wider">Henüz Ekli Arkadaşın Yok 🏜️</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Arkadaş Ekle sekmesinden Kullanıcı Adı yazarak arkadaşlarınızı ekleyebilir, düellolara davet edebilirsiniz!
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('add')}
                    className="mt-2 px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-amber-400 transition cursor-pointer"
                  >
                    Arkadaş Arama Yap
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {confirmedFriends.map((friend) => {
                    const online = isFriendOnline(friend);
                    const isBusy = friend.stats?.rating === -1; // Or game state check
                    return (
                      <div
                        key={friend.id}
                        className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center justify-between text-left hover:border-slate-700 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Avatar with status indicator */}
                          <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center font-bold text-sm border border-slate-700 shrink-0 relative overflow-hidden">
                            <UserAvatar avatarUrl={friend.avatarUrl} name={friend.name} fallbackIcon="?" textClassName="text-sm font-bold text-slate-300" />
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#161D2B] ${
                                online ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse' : 'bg-slate-600'
                              }`}
                              title={online ? 'Çevrimiçi' : 'Çevrimdışı'}
                            />
                          </div>

                          {/* Info */}
                          <div className="min-w-0">
                            <span className="text-xs font-black text-white block truncate">{friend.name || 'Oyuncu'}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[9.5px] font-bold font-mono px-1.5 py-0.2 rounded ${
                                online 
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}>
                                {online ? '🟢 ÇEVRİMİÇİ' : '🔴 ÇEVRİMDIŞI'}
                              </span>
                              {friend.stats?.rating !== undefined && (
                                <span className="text-[9.5px] text-amber-300 font-mono font-bold">
                                  ⭐ {friend.stats.rating}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {onChallengePlayer && online && (
                            <button
                              type="button"
                              disabled={isChallengePending}
                              onClick={() => onChallengePlayer(friend, getDeckRandomLength())}
                              className={`px-2.5 py-1.5 rounded-xl text-[10.5px] font-black uppercase transition flex items-center gap-1 border ${
                                isChallengePending
                                  ? 'bg-slate-800 text-slate-500 border-slate-700 opacity-60 cursor-not-allowed'
                                  : 'bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 border-amber-200/40 shadow-md shadow-amber-500/10 cursor-pointer'
                              }`}
                              title={isChallengePending ? 'İstek Bekleniyor...' : 'Düelloya Davet Et'}
                            >
                              <Swords size={12} />
                              <span className="hidden sm:inline">
                                {isChallengePending ? 'Bekleniyor...' : 'Meydan Oku'}
                              </span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={pendingActionId === friend.id}
                            onClick={() => handleRemoveFriend(friend)}
                            className="p-2 rounded-xl text-rose-400 hover:text-rose-200 hover:bg-rose-500/20 border border-transparent hover:border-rose-500/30 transition cursor-pointer disabled:opacity-50"
                            title="Arkadaş Çıkar"
                          >
                            {pendingActionId === friend.id ? (
                              <RefreshCw size={15} className="animate-spin text-rose-400" />
                            ) : (
                              <UserMinus size={15} />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ADD FRIEND (SEARCH BY USERNAME) */}
          {activeTab === 'add' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Arkadaş Arama (Kullanıcı Adı)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Kullanıcı adı yazın..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSearch();
                      }}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={searching || !searchTerm.trim()}
                    onClick={handleSearch}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {searching ? 'Aranıyor...' : 'Bul'}
                  </button>
                </div>
              </div>

              {/* Search Results */}
              {searching ? (
                <div className="text-center py-8 text-slate-400">
                  <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs font-mono uppercase">Oyuncular Aranıyor...</p>
                </div>
              ) : searchDone && searchResults.length === 0 ? (
                <div className="text-center py-8 bg-slate-900/50 rounded-2xl border border-slate-800 p-4">
                  <AlertCircle size={20} className="text-amber-400 mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-amber-300 uppercase">Oyuncu Bulunamadı 🔍</p>
                  <p className="text-[10.5px] text-slate-400 mt-1">
                    Girdiğiniz kullanıcı adıyla eşleşen bir oyuncu bulunamadı. Lütfen kullanıcı adını doğru girdiğinizden emin olun.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((user) => {
                    const isAlreadyFriend = confirmedFriends.some(f => f.id === user.id) || (profile.friends || []).includes(user.id);
                    const isRequestSent = sentRequests.has(user.id);

                    return (
                      <div
                        key={user.id}
                        className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center justify-between text-left"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-2xl bg-slate-800 flex items-center justify-center font-bold text-xs border border-slate-700 shrink-0 overflow-hidden">
                            <UserAvatar avatarUrl={user.avatarUrl} name={user.name} fallbackIcon="?" textClassName="text-xs font-bold text-slate-300" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-black text-white block truncate">{user.name || 'Oyuncu'}</span>
                          </div>
                        </div>

                        <div className="shrink-0 ml-2">
                          {isAlreadyFriend ? (
                            <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-[10px] font-bold flex items-center gap-1">
                              <CheckCircle size={12} />
                              Arkadaşsınız
                            </span>
                          ) : isRequestSent ? (
                            <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-[10px] font-bold">
                              İstek Gönderildi
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={pendingActionId === user.id}
                              onClick={() => handleAddFriend(user)}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black uppercase transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <UserPlus size={13} />
                              <span>Ekle</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: INCOMING REQUESTS */}
          {activeTab === 'requests' && (
            <div>
              {incomingRequests.length === 0 ? (
                <div className="text-center py-10 bg-slate-900/50 rounded-2xl border border-slate-800 p-4">
                  <UserCheck size={22} className="text-slate-500 mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-slate-300 uppercase">Bekleyen İstek Yok</p>
                  <p className="text-[10.5px] text-slate-400 mt-1">Sana gönderilen arkadaşlık istekleri burada listelenecektir.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {incomingRequests.map((reqUser) => (
                    <div
                      key={reqUser.id}
                      className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center justify-between text-left"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-2xl bg-slate-800 flex items-center justify-center font-bold text-xs border border-slate-700 shrink-0 overflow-hidden">
                          <UserAvatar avatarUrl={reqUser.avatarUrl} name={reqUser.name} fallbackIcon="?" textClassName="text-xs font-bold text-slate-300" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-black text-white block truncate">{reqUser.name}</span>
                          <span className="text-[9.5px] text-emerald-400 font-mono font-bold block">Sana arkadaşlık isteği gönderdi</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={pendingActionId === reqUser.id}
                        onClick={() => handleAcceptRequest(reqUser)}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs font-black uppercase transition flex items-center gap-1 cursor-pointer shadow-md shadow-emerald-500/20 disabled:opacity-50 shrink-0 ml-2"
                      >
                        <Check size={13} />
                        <span>Kabul Et</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition cursor-pointer border border-slate-700 shrink-0"
        >
          Kapat
        </button>

      </div>
    </div>
  );
}
