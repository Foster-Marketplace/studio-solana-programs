macro_rules! instruction {
    ($ix:ident) => {
        pub mod $ix;
        pub use $ix::*;
    };
}

instruction!(configure_product);
instruction!(buy_product);
instruction!(delete_product);
