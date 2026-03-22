module initia_agent::agent_actions {
    use std::signer;
    use std::error;

    const ENOT_ENOUGH_SHARDS: u64 = 1;
    const ENOT_ENOUGH_GEMS: u64 = 2;
    const ENOT_ENOUGH_RELICS: u64 = 3;
    const EINVENTORY_NOT_FOUND: u64 = 4;

    struct Inventory has key {
        shards: u64,
        relics: u64,
        gems: u64,
        legendary_relics: u64,
    }

    fun ensure_inventory(account: &signer) {
        let addr = signer::address_of(account);
        if (!exists<Inventory>(addr)) {
            move_to(account, Inventory {
                shards: 0,
                relics: 0,
                gems: 0,
                legendary_relics: 0,
            });
        }
    }

    // --- Entry functions ---

    public entry fun mint_shard(account: &signer) acquires Inventory {
        ensure_inventory(account);
        let inv = borrow_global_mut<Inventory>(signer::address_of(account));
        inv.shards = inv.shards + 1;
    }

    public entry fun mint_gem(account: &signer) acquires Inventory {
        ensure_inventory(account);
        let inv = borrow_global_mut<Inventory>(signer::address_of(account));
        inv.gems = inv.gems + 1;
    }

    /// Burns 2 shards + 1 gem to craft 1 relic.
    public entry fun craft_relic(account: &signer) acquires Inventory {
        ensure_inventory(account);
        let inv = borrow_global_mut<Inventory>(signer::address_of(account));
        assert!(inv.shards >= 2, error::invalid_argument(ENOT_ENOUGH_SHARDS));
        assert!(inv.gems >= 1, error::invalid_argument(ENOT_ENOUGH_GEMS));
        inv.shards = inv.shards - 2;
        inv.gems = inv.gems - 1;
        inv.relics = inv.relics + 1;
    }

    /// Burns 3 relics to produce 1 legendary relic.
    public entry fun upgrade_relic(account: &signer) acquires Inventory {
        ensure_inventory(account);
        let inv = borrow_global_mut<Inventory>(signer::address_of(account));
        assert!(inv.relics >= 3, error::invalid_argument(ENOT_ENOUGH_RELICS));
        inv.relics = inv.relics - 3;
        inv.legendary_relics = inv.legendary_relics + 1;
    }

    // --- View functions ---

    #[view]
    public fun inventory_of(addr: address): (u64, u64, u64, u64) acquires Inventory {
        assert!(exists<Inventory>(addr), error::not_found(EINVENTORY_NOT_FOUND));
        let inv = borrow_global<Inventory>(addr);
        (inv.shards, inv.relics, inv.gems, inv.legendary_relics)
    }

    #[view]
    public fun shard_count(addr: address): u64 acquires Inventory {
        assert!(exists<Inventory>(addr), error::not_found(EINVENTORY_NOT_FOUND));
        borrow_global<Inventory>(addr).shards
    }

    #[view]
    public fun gem_count(addr: address): u64 acquires Inventory {
        assert!(exists<Inventory>(addr), error::not_found(EINVENTORY_NOT_FOUND));
        borrow_global<Inventory>(addr).gems
    }

    #[view]
    public fun relic_count(addr: address): u64 acquires Inventory {
        assert!(exists<Inventory>(addr), error::not_found(EINVENTORY_NOT_FOUND));
        borrow_global<Inventory>(addr).relics
    }

    // --- Tests ---

    #[test(account = @0x1)]
    fun test_mint_shard(account: &signer) acquires Inventory {
        mint_shard(account);
        assert!(shard_count(@0x1) == 1, 0);
        mint_shard(account);
        assert!(shard_count(@0x1) == 2, 1);
    }

    #[test(account = @0x1)]
    fun test_mint_gem(account: &signer) acquires Inventory {
        mint_gem(account);
        assert!(gem_count(@0x1) == 1, 0);
        mint_gem(account);
        assert!(gem_count(@0x1) == 2, 1);
    }

    #[test(account = @0x1)]
    fun test_craft_relic_success(account: &signer) acquires Inventory {
        mint_shard(account);
        mint_shard(account);
        mint_gem(account);
        craft_relic(account);
        let (shards, relics, gems, legendary) = inventory_of(@0x1);
        assert!(shards == 0, 0);
        assert!(relics == 1, 1);
        assert!(gems == 0, 2);
        assert!(legendary == 0, 3);
    }

    #[test(account = @0x1)]
    #[expected_failure(abort_code = 0x10001, location = Self)]
    fun test_craft_relic_insufficient_shards(account: &signer) acquires Inventory {
        mint_gem(account);
        craft_relic(account);
    }

    #[test(account = @0x1)]
    #[expected_failure(abort_code = 0x10002, location = Self)]
    fun test_craft_relic_insufficient_gems(account: &signer) acquires Inventory {
        mint_shard(account);
        mint_shard(account);
        craft_relic(account);
    }

    #[test(account = @0x1)]
    fun test_upgrade_relic_success(account: &signer) acquires Inventory {
        // Craft 3 relics (each needs 2 shards + 1 gem)
        let i = 0;
        while (i < 6) { mint_shard(account); i = i + 1; };
        let j = 0;
        while (j < 3) { mint_gem(account); j = j + 1; };
        craft_relic(account);
        craft_relic(account);
        craft_relic(account);
        assert!(relic_count(@0x1) == 3, 0);
        upgrade_relic(account);
        let (shards, relics, gems, legendary) = inventory_of(@0x1);
        assert!(shards == 0, 1);
        assert!(relics == 0, 2);
        assert!(gems == 0, 3);
        assert!(legendary == 1, 4);
    }

    #[test(account = @0x1)]
    #[expected_failure(abort_code = 0x10003, location = Self)]
    fun test_upgrade_relic_insufficient_relics(account: &signer) acquires Inventory {
        // Craft only 2 relics, then try to upgrade
        let i = 0;
        while (i < 4) { mint_shard(account); i = i + 1; };
        mint_gem(account);
        mint_gem(account);
        craft_relic(account);
        craft_relic(account);
        upgrade_relic(account);
    }

    #[test(account = @0x1)]
    fun test_inventory_of(account: &signer) acquires Inventory {
        mint_shard(account);
        mint_shard(account);
        mint_shard(account);
        mint_gem(account);
        mint_gem(account);
        let (shards, relics, gems, legendary) = inventory_of(@0x1);
        assert!(shards == 3, 0);
        assert!(relics == 0, 1);
        assert!(gems == 2, 2);
        assert!(legendary == 0, 3);
    }

    #[test]
    #[expected_failure(abort_code = 0x60004, location = Self)]
    fun test_inventory_of_nonexistent() acquires Inventory {
        inventory_of(@0x99);
    }

    #[test]
    #[expected_failure(abort_code = 0x60004, location = Self)]
    fun test_shard_count_nonexistent() acquires Inventory {
        shard_count(@0x99);
    }

    #[test]
    #[expected_failure(abort_code = 0x60004, location = Self)]
    fun test_gem_count_nonexistent() acquires Inventory {
        gem_count(@0x99);
    }

    #[test]
    #[expected_failure(abort_code = 0x60004, location = Self)]
    fun test_relic_count_nonexistent() acquires Inventory {
        relic_count(@0x99);
    }

    #[test(account = @0x1)]
    fun test_full_crafting_pipeline(account: &signer) acquires Inventory {
        // Mint 6 shards + 3 gems -> craft 3 relics -> upgrade to 1 legendary
        let i = 0;
        while (i < 6) { mint_shard(account); i = i + 1; };
        let j = 0;
        while (j < 3) { mint_gem(account); j = j + 1; };
        craft_relic(account);
        craft_relic(account);
        craft_relic(account);
        upgrade_relic(account);

        // Mint more and verify independent tracking
        mint_shard(account);
        mint_gem(account);
        let (shards, relics, gems, legendary) = inventory_of(@0x1);
        assert!(shards == 1, 0);
        assert!(relics == 0, 1);
        assert!(gems == 1, 2);
        assert!(legendary == 1, 3);
    }
}
