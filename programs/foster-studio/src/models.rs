#[derive(Insertable, Queryable, AsChangeset, Serialize, Deserialize, Debug, Clone)]
#[table_name = "merch_products"]
pub struct MerchProduct {
    pub id: i32,
    pub user_id: i32,
    pub name: String,
    pub description: String,
    pub fulfillment_type: String,
    pub product_type_id: i32, // No product categories/types
    pub selling_price: i32,
    pub foster_amount: i32,
    pub supply: Option<i32>,
    pub master_edition_address: Option<String>,
    pub sale_start_at: Option<NaiveDateTime>,
    pub sale_end_at: Option<NaiveDateTime>,
    pub options: serde_json::Value,
    pub created_at: NaiveDateTime,
    pub updated_at: Option<NaiveDateTime>,
    pub deleted_at: Option<NaiveDateTime>,
}

impl MerchProduct {
    pub fn with_current_supply(self, current_supply: u32) -> MerchProductWithCurrentSupply {
        self.with_current_supply_and_listing(current_supply, None)
    }

    pub fn with_current_supply_and_listing(
        self,
        current_supply: u32,
        listed_master_edition: Option<ListedMasterEdition>,
    ) -> MerchProductWithCurrentSupply {
        MerchProductWithCurrentSupply {
            id: self.id,
            user_id: self.user_id,
            name: self.name,
            description: self.description,
            fulfillment_type: self.fulfillment_type,
            product_type_id: self.product_type_id,
            selling_price: self.selling_price,
            foster_amount: self.foster_amount,
            current_supply,
            supply: self.supply,
            master_edition_address: self.master_edition_address,
            listed_master_edition: listed_master_edition.map(|listing| listing.try_into().unwrap()),
            sale_start_at: self.sale_start_at,
            sale_end_at: self.sale_end_at,
            options: self.options,
            created_at: self.created_at,
            updated_at: self.updated_at,
            deleted_at: self.deleted_at,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct MerchProductWithCurrentSupply {
    pub id: i32,
    pub user_id: i32,
    pub name: String,
    pub description: String,
    pub fulfillment_type: String,
    pub product_type_id: i32,
    pub selling_price: i32,
    pub foster_amount: i32,
    pub current_supply: u32,
    pub supply: Option<i32>,
    pub master_edition_address: Option<String>,
    pub listed_master_edition: Option<ListedMasterEditionResponse>,
    pub sale_start_at: Option<NaiveDateTime>,
    pub sale_end_at: Option<NaiveDateTime>,
    pub options: serde_json::Value,
    pub created_at: NaiveDateTime,
    pub updated_at: Option<NaiveDateTime>,
    pub deleted_at: Option<NaiveDateTime>,
}

impl From<MerchProduct> for MerchProductWithCurrentSupply {
    fn from(product: MerchProduct) -> Self {
        product.with_current_supply(0)
    }
}

impl MerchProductWithCurrentSupply {
    pub fn with_user(
        self,
        user_wallet: String,
        username: Option<String>,
        user_profile_picture: Option<String>,
    ) -> MerchEditionWithUser {
        MerchEditionWithUser {
            id: self.id,
            name: self.name,
            description: self.description,
            fulfillment_type: self.fulfillment_type,
            product_type_id: self.product_type_id,
            selling_price: self.selling_price,
            foster_amount: self.foster_amount,
            current_supply: self.current_supply,
            supply: self.supply,
            master_edition_address: self.master_edition_address,
            listed_master_edition: self.listed_master_edition,
            sale_start_at: self.sale_start_at,
            sale_end_at: self.sale_end_at,
            options: self.options,
            created_at: self.created_at,
            updated_at: self.updated_at,
            deleted_at: self.deleted_at,

            user_id: self.user_id,
            user_wallet,
            username,
            user_profile_picture,
        }
    }

    pub fn with_nft_and_user_and_order_id(
        self,
        nft: SingleNft,
        user_wallet: String,
        username: Option<String>,
        user_profile_picture: Option<String>,
        order_id: Option<i32>,
    ) -> MerchEditionWithNftAndUser {
        MerchEditionWithNftAndUser {
            id: self.id,
            name: self.name,
            description: self.description,
            fulfillment_type: self.fulfillment_type,
            product_type_id: self.product_type_id,
            selling_price: self.selling_price,
            foster_amount: self.foster_amount,
            current_supply: self.current_supply,
            supply: self.supply,
            master_edition_address: self.master_edition_address,
            listed_master_edition: self.listed_master_edition,
            sale_start_at: self.sale_start_at,
            sale_end_at: self.sale_end_at,
            options: self.options,
            created_at: self.created_at,
            updated_at: self.updated_at,
            deleted_at: self.deleted_at,

            nft,
            order_id,

            user_id: self.user_id,
            user_wallet,
            username,
            user_profile_picture,
        }
    }
}

