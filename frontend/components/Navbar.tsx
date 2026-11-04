"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Heart,
  Menu,
  Search,
  ShoppingBag,
  Sparkles,
  UserRound,
  X,
  LogOut,
  User,
  Package,
  Layers,
  Shield,
  ChevronDown,
} from "lucide-react";
import CartIcon from "@/components/CartIcon";
import { useAuth } from "@/context/AuthContext";
import { getWishlist } from "@/lib/wishlist";

interface NavbarProps {
  currentPath?: string;
}

export default function Navbar({ currentPath }: NavbarProps) {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const router = useRouter();

  const [wishlistCount, setWishlistCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function updateWishlistCounter() {
      setWishlistCount(getWishlist().length);
    }

    updateWishlistCounter();
    window.addEventListener("wishlist-updated", updateWishlistCounter);
    window.addEventListener("storage", updateWishlistCounter);

    return () => {
      window.removeEventListener("wishlist-updated", updateWishlistCounter);
      window.removeEventListener("storage", updateWishlistCounter);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setUserDropdownOpen(false);
    setMenuOpen(false);
    router.push("/");
  };

  return (
    <>
      <header className="navbar">
        <Link href="/" className="logo" aria-label="FashionIQ home">
          fashion<span>IQ</span>
          <Sparkles size={15} className="logo-sparkle" />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className={`nav-links ${menuOpen ? "nav-open" : ""}`}>
          <Link
            href="/products"
            onClick={() => setMenuOpen(false)}
            className={currentPath === "/products" ? "font-semibold text-black" : ""}
          >
            Discover
          </Link>
          <Link
            href="/outfits"
            onClick={() => setMenuOpen(false)}
            className={currentPath === "/outfits" ? "font-semibold text-black" : ""}
          >
            Outfits
          </Link>
          <Link
            href="/#trending"
            onClick={() => setMenuOpen(false)}
          >
            Trending
          </Link>
          <Link
            href="/#about"
            onClick={() => setMenuOpen(false)}
          >
            Our story
          </Link>
          <Link
            href="/wishlist"
            className="text-sm text-gray-700 hover:text-black"
            onClick={() => setMenuOpen(false)}
          >
            Wishlist
          </Link>
          <CartIcon />

          {/* Mobile User Controls inside drawer */}
          <div className="mt-6 flex flex-col gap-3 border-t border-gray-200 pt-6 md:hidden">
            {isAuthenticated && user ? (
              <>
                <div className="px-2 py-1">
                  <p className="text-xs text-gray-500">Signed in as</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {user.first_name} {user.last_name}
                  </p>
                  {isAdmin && (
                    <span className="mt-1 inline-block rounded-full bg-[#c65b3b] px-2 py-0.5 text-[10px] font-semibold text-white">
                      ADMIN
                    </span>
                  )}
                </div>
                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-800"
                  >
                    <Shield size={16} /> Admin Portal
                  </Link>
                )}
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 text-sm text-gray-800"
                >
                  <User size={16} /> Style Profile & Address
                </Link>
                <Link
                  href="/wardrobe"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 text-sm text-gray-800"
                >
                  <Layers size={16} /> Digital Wardrobe
                </Link>
                <Link
                  href="/outfits"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 text-sm text-gray-800"
                >
                  <Sparkles size={16} /> Outfit Studio
                </Link>
                <Link
                  href="/orders"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 text-sm text-gray-800"
                >
                  <Package size={16} /> Order History
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-left text-sm font-medium text-red-600 pt-2"
                >
                  <LogOut size={16} /> Sign out
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-full bg-black py-2.5 text-center text-sm font-medium text-white"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-full border border-gray-300 py-2.5 text-center text-sm font-medium text-gray-800"
                >
                  Create account
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* Desktop Action Icons & User Dropdown */}
        <div className="nav-actions">
          <Link href="/products" aria-label="Search catalog">
            <Search size={20} />
          </Link>

          <Link href="/wishlist" aria-label="Your wishlist" className="relative">
            <Heart size={20} />
            {wishlistCount > 0 && (
              <span className="nav-count">{wishlistCount}</span>
            )}
          </Link>

          <Link href="/cart" aria-label="Shopping bag">
            <ShoppingBag size={20} />
          </Link>

          {/* User Account / Dropdown */}
          {isAuthenticated && user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 shadow-xs hover:border-gray-400"
                aria-expanded={userDropdownOpen}
                aria-haspopup="true"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black text-[11px] font-semibold text-white uppercase">
                  {user.first_name[0] || "U"}
                </span>
                <span className="hidden sm:inline font-medium">
                  {user.first_name}
                </span>
                {isAdmin && (
                  <span className="rounded-full bg-[#c65b3b] px-1.5 py-0.2 text-[9px] font-bold text-white">
                    ADMIN
                  </span>
                )}
                <ChevronDown size={14} className="text-gray-500" />
              </button>

              {/* Dropdown Menu */}
              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-gray-200 bg-white py-2 shadow-lg z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="border-b border-gray-100 px-4 py-2">
                    <p className="text-xs font-semibold text-gray-900">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="truncate text-xs text-gray-500">{user.email}</p>
                  </div>

                  {isAdmin && (
                    <div className="border-b border-gray-100 py-1">
                      <Link
                        href="/admin"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#c65b3b] hover:bg-gray-50"
                      >
                        <Shield size={14} /> Admin Portal
                      </Link>
                    </div>
                  )}

                  <div className="py-1">
                    <Link
                      href="/profile"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      <User size={14} /> Style Profile & Address
                    </Link>
                    <Link
                      href="/wardrobe"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      <Layers size={14} /> Digital Wardrobe
                    </Link>
                    <Link
                      href="/outfits"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      <Sparkles size={14} /> Outfit Studio
                    </Link>
                    <Link
                      href="/orders"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      <Package size={14} /> Order History
                    </Link>
                  </div>

                  <div className="border-t border-gray-100 pt-1">
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      <LogOut size={14} /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 shadow-xs hover:border-black"
              aria-label="Sign in"
            >
              <UserRound size={15} />
              <span className="hidden sm:inline">Sign in</span>
            </Link>
          )}
        </div>

        {/* Mobile menu hamburger toggle */}
        <button
          className="mobile-menu"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          {menuOpen ? <X size={23} /> : <Menu size={23} />}
        </button>
      </header>
    </>
  );
}
