//! Build script for NAPI bindings

fn main() {
    // Only build NAPI bindings if the napi feature is enabled
    #[cfg(feature = "napi")]
    {
        println!("cargo:rustc-cfg=napi");
    }
}

