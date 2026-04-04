"use client";

import "./CSS/Dashboard.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import RoadmapTimeline from "./Components/AnalyticsFolder/RoadmapTimeline";
import logoImage from "../asset/logo.png";
import { LayoutDashboard, ChartColumnBig, Map } from "lucide-react";
import DashboardSection from "./Components/Dashboard";
import CsvImporter, { ImportedRow } from ".//Components/CsvImporter";

import {
  listEntriesByUser,
  createEntryFromUi,
  deleteEntryApi,
  getCurrentUser,
  logoutUser,
  type AuthUser,
} from "@/lib/bridge";
import Analytics from "./Components/AnalyticsFolder/Analytics";

import {
  enqueueQuickEntry,
  flushPendingQuickEntries,
  listPendingQuickEntries,
  deletePendingQuickEntry,
  registerQuickEntryServiceWorker,
  registerQuickEntrySync,
} from "@/lib/quickEntryQueue";

type Transaction = {
  type: "income" | "expense";
  category: string;
  amount: number;
};

type Entry = {
  id: string;
  type: "income" | "expense";
  name: string;
  category: string;
  amount: number;
  date: Date;
  pendingSync?: boolean;
};

export default function Home() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [pendingEntries, setPendingEntries] = useState<Entry[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  const [navScrolled, setNavScrolled] = useState(false);
  const [navOffset, setNavOffset] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);

  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const navOffsetRef = useRef(0);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const flushTimeoutRef = useRef<number | null>(null);

  const NAV_HIDE_DISTANCE = 110;

  const scheduleFlush = () => {
    if (flushTimeoutRef.current) {
      window.clearTimeout(flushTimeoutRef.current);
    }

    flushTimeoutRef.current = window.setTimeout(() => {
      flushQuickEntriesAndRefresh();
    }, 1500);
  };

  useEffect(() => {
    registerQuickEntryServiceWorker();

    const onOnline = () => {
      scheduleFlush();
      registerQuickEntrySync();
    };

    window.addEventListener("online", onOnline);

    const interval = window.setInterval(() => {
      scheduleFlush();
    }, 20000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(interval);
      if (flushTimeoutRef.current) {
        window.clearTimeout(flushTimeoutRef.current);
      }
    };
  }, [currentUser?.id, selectedMonth]);

  useEffect(() => {
    const user = getCurrentUser();

    if (!user?.id || !user?.email) {
      logoutUser();
      router.replace("/login");
      return;
    }

    setCurrentUser(user);
    setAuthChecked(true);
  }, [router]);

  useEffect(() => {
    lastScrollY.current = window.scrollY || 0;

    const updateNavbar = () => {
      const currentY = window.scrollY;
      const diff = currentY - lastScrollY.current;

      setNavScrolled(currentY > 16);

      if (currentY <= 0) {
        navOffsetRef.current = 0;
        setNavOffset(0);
      } else {
        let nextOffset = navOffsetRef.current + diff;

        if (nextOffset < 0) nextOffset = 0;
        if (nextOffset > NAV_HIDE_DISTANCE) nextOffset = NAV_HIDE_DISTANCE;

        if (Math.abs(diff) > 0.25) {
          navOffsetRef.current = nextOffset;
          setNavOffset(nextOffset);
        }

        if (diff > 0.8) {
          setProfileOpen(false);
        }
      }

      lastScrollY.current = currentY;
      ticking.current = false;
    };

    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(updateNavbar);
        ticking.current = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const makeId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  useEffect(() => {
    if (!currentUser?.id) return;

    fetchEntriesForMonth(currentUser.id, selectedMonth);
    loadPendingEntriesForMonth(currentUser.id, selectedMonth);
  }, [currentUser?.id, selectedMonth]);

  const fetchEntriesForMonth = async (userId: string, monthDate: Date) => {
    setLoadingEntries(true);

    try {
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth() + 1;

      const apiEntries = await listEntriesByUser({
        userId,
        year,
        month,
      });

      const normalizedEntries: Entry[] = (apiEntries ?? []).map((item) => ({
        id: String(item.id),
        type: item.type === "income" ? "income" : "expense",
        name: item.name ?? "Unknown",
        category: item.category ?? "Other",
        amount: Number(item.amount ?? 0),
        date: new Date(item.date),
      }));

      setEntries(normalizedEntries);
    } catch (err) {
      console.error("Failed to fetch entries for selected month:", err);
      setEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  };

  const addQuickEntry = async (
    type: "income" | "expense",
    category: string,
    amount: number
  ) => {
    if (!currentUser?.id) {
      router.replace("/login");
      return;
    }

    setTransactions((prev) => [...prev, { type, category, amount }]);

    const today = new Date();
    const isSameSelectedMonthAsToday =
      selectedMonth.getFullYear() === today.getFullYear() &&
      selectedMonth.getMonth() === today.getMonth();

    const quickDate = isSameSelectedMonthAsToday
      ? new Date(today.getFullYear(), today.getMonth(), today.getDate())
      : new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);

    const tempId = `pending-${makeId()}`;

    const optimisticEntry: Entry = {
      id: tempId,
      type,
      name: "QuickEntry",
      category,
      amount: Math.abs(amount),
      date: quickDate,
      pendingSync: true,
    };

    await enqueueQuickEntry({
      localId: tempId,
      userId: currentUser.id,
      date: dateToYmd(quickDate),
      type,
      name: "QuickEntry",
      category,
      amount: Math.abs(amount),
      createdAt: Date.now(),
      status: "pending",
      retryCount: 0,
      apiBase: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
    } as any);

    setPendingEntries((prev) => [optimisticEntry, ...prev]);

    try {
      scheduleFlush();
      await registerQuickEntrySync();
    } catch (err) {
      console.error("Quick entry queued for retry:", err);
      await registerQuickEntrySync();
    }
  };

  const deleteEntry = async (id: string) => {
    if (id.startsWith("pending-")) {
      await deletePendingQuickEntry(id);
      setPendingEntries((prev) => prev.filter((e) => e.id !== id));
      return;
    }

    const snapshot = entries;
    setEntries((prev) => prev.filter((e) => e.id !== id));

    try {
      const res = await deleteEntryApi(id);

      if (!res?.deleted) {
        throw new Error("Backend did not confirm deletion");
      }

      if (currentUser?.id) {
        await fetchEntriesForMonth(currentUser.id, selectedMonth);
      }
    } catch (err) {
      console.error("Failed to delete entry:", err);
      setEntries(snapshot);
    }
  };

  const handleCsvData = async (rows: ImportedRow[]) => {
    if (!currentUser?.id) {
      router.replace("/login");
      return;
    }

    const converted: Entry[] = rows.map((r) => {
      const [y, m, d] = r.date.split("-").map(Number);

      return {
        id: makeId(),
        type: r.amount < 0 ? "expense" : "income",
        name: r.name || "Unknown",
        category: r.category || "Other",
        amount: Math.abs(r.amount),
        date: new Date(y, m - 1, d),
      };
    });

    setEntries((prev) => [...converted, ...prev]);

    const results = await Promise.allSettled(
      converted.map(async (temp) => {
        const created = await createEntryFromUi({
          type: temp.type,
          name: temp.name,
          category: temp.category,
          amount: temp.amount,
          date: temp.date,
        });

        return { tempId: temp.id, created };
      })
    );

    setEntries((prev) => {
      let next = [...prev];

      results.forEach((result) => {
        if (result.status === "fulfilled") {
          const { tempId, created } = result.value;
          next = next.map((e) => (e.id === tempId ? created : e));
        }
      });

      const failedTempIds = results
        .map((result, idx) =>
          result.status === "rejected" ? converted[idx].id : null
        )
        .filter((id): id is string => Boolean(id));

      next = next.filter((e) => !failedTempIds.includes(e.id));

      return next;
    });

    results.forEach((result, idx) => {
      if (result.status === "rejected") {
        console.error("CSV row failed to import:", converted[idx], result.reason);
      }
    });
  };

  const handleLogout = () => {
    setProfileOpen(false);
    logoutUser();
    router.push("/login");
  };

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (!el) return;

    const navbarOffset = 120;
    const y = el.getBoundingClientRect().top + window.scrollY - navbarOffset;

    window.scrollTo({
      top: y,
      behavior: "smooth",
    });
  };

  function dateToYmd(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const loadPendingEntriesForMonth = async (userId: string, monthDate: Date) => {
    const all = await listPendingQuickEntries(userId);

    const filtered = all
      .filter((item) => {
        const d = new Date(`${item.date}T00:00:00`);
        return (
          d.getFullYear() === monthDate.getFullYear() &&
          d.getMonth() === monthDate.getMonth()
        );
      })
      .map((item) => ({
        id: item.localId,
        type: item.type,
        name: item.name,
        category: item.category,
        amount: item.amount,
        date: new Date(`${item.date}T00:00:00`),
        pendingSync: true,
      }));

    setPendingEntries(filtered);
  };

  const flushQuickEntriesAndRefresh = async () => {
    if (!currentUser?.id) return;

    const synced = await flushPendingQuickEntries();

    if (synced.length > 0) {
      const syncedIds = new Set(synced.map((x) => x.localId));
      setPendingEntries((prev) => prev.filter((e) => !syncedIds.has(e.id)));
      await fetchEntriesForMonth(currentUser.id, selectedMonth);
    }

    await loadPendingEntriesForMonth(currentUser.id, selectedMonth);
  };

  const displayName =
    currentUser?.email?.split("@")[0] ||
    "User";

  const userInitial = displayName.charAt(0).toUpperCase();

  const lastIncomeCategory = useMemo(
    () =>
      [...transactions]
        .filter((t) => t.type === "income")
        .map((t) => t.category)
        .pop() || "Salary",
    [transactions]
  );

  const lastExpenseCategory = useMemo(
    () =>
      [...transactions]
        .filter((t) => t.type === "expense")
        .map((t) => t.category)
        .pop() || "Food",
    [transactions]
  );

  const allEntries = useMemo(() => {
    return [...pendingEntries, ...entries];
  }, [pendingEntries, entries]);

  const entriesThisMonth = useMemo(() => {
    return allEntries.filter((e) => {
      return (
        e.date.getMonth() === selectedMonth.getMonth() &&
        e.date.getFullYear() === selectedMonth.getFullYear()
      );
    });
  }, [allEntries, selectedMonth]);

  if (!authChecked || !currentUser) {
    return null;
  }

  return (
    <div className="home-page-shell">
      <div className="ambient ambient-1" />
      <div className="ambient ambient-2" />
      <div className="ambient ambient-3" />

      <div
        className={`top-nav-wrap ${navScrolled ? "scrolled" : ""}`}
        style={{
          transform: `translateY(-${navOffset}px)`,
          opacity: Math.max(0.72, 1 - navOffset / 220),
        }}
      >
        <div className="top-nav">
          <div className="nav-brand">
            <div className="brand-logo-wrap">
              <Image
                src={logoImage}
                alt="Money Compass logo"
                width={42}
                height={42}
                className="brand-logo"
                priority
              />
            </div>
            <span className="brand-text">Money Compass</span>
          </div>

          <div className="nav-center">
            <button
              onClick={() => scrollToSection("dashboard-section")}
              className="nav-btn"
              aria-label="Dashboard"
              title="Dashboard"
            >
              <span className="nav-btn-icon">
                <LayoutDashboard size={18} strokeWidth={2.2} />
              </span>
              <span className="nav-btn-label">Dashboard</span>
            </button>

            <button
              onClick={() => scrollToSection("analytics-section")}
              className="nav-btn"
              aria-label="Analytics"
              title="Analytics"
            >
              <span className="nav-btn-icon">
                <ChartColumnBig size={18} strokeWidth={2.2} />
              </span>
              <span className="nav-btn-label">Analytics</span>
            </button>

            <button
              onClick={() => scrollToSection("journey-section")}
              className="nav-btn"
              aria-label="Journey Progress"
              title="Journey Progress"
            >
              <span className="nav-btn-icon">
                <Map size={18} strokeWidth={2.2} />
              </span>
              <span className="nav-btn-label">Journey Progress</span>
            </button>
          </div>

          <div className="nav-right" ref={profileRef}>
            <button
              className="profile-trigger"
              onClick={() => setProfileOpen((prev) => !prev)}
              aria-label="Open profile menu"
              aria-expanded={profileOpen}
            >
              <span className="profile-avatar">{userInitial}</span>
              <span className="profile-name">{displayName}</span>
            </button>

            <div className={`profile-dropdown ${profileOpen ? "open" : ""}`}>
              <div className="profile-dropdown-user">
                <div className="profile-dropdown-avatar">{userInitial}</div>
                <div className="profile-dropdown-text">
                  <div className="profile-dropdown-email">{currentUser.email}</div>
                </div>
              </div>

              <button onClick={handleLogout} className="dropdown-logout-btn">
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="page-content">
        <DashboardSection
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          entries={allEntries}
          entriesThisMonth={entriesThisMonth}
          loadingEntries={loadingEntries}
          lastIncomeCategory={lastIncomeCategory}
          lastExpenseCategory={lastExpenseCategory}
          addQuickEntry={addQuickEntry}
          handleCsvData={handleCsvData}
          deleteEntry={deleteEntry}
        />

        <section id="analytics-section" className="section-block">
          <Analytics userId={currentUser.id} />
        </section>

        <section id="journey-section" className="section-block thirdpart-container p-4 ">
          <h1 className="main-heading" style={{ color: "#f8fafc" }}>
            Journey Progress
          </h1>
          <h3 style={{ color: "#94a3b8" }}>
            How to become Financial independent ?
          </h3>
          <RoadmapTimeline userId={currentUser.id} />
        </section>
      </div>

      <style jsx>{`
        .thirdpart-container h3 {
          margin-bottom: 10px;
        }

        .home-page-shell {
          min-height: 100vh;
          position: relative;
          overflow-x: hidden;
          color: #e5eefb;
          background:
            radial-gradient(circle at 12% 20%, rgba(111, 66, 193, 0.22), transparent 28%),
            radial-gradient(circle at 88% 18%, rgba(14, 165, 233, 0.18), transparent 26%),
            radial-gradient(circle at 50% 100%, rgba(255, 255, 255, 0.06), transparent 34%),
            linear-gradient(135deg, #05070d 0%, #0b1020 45%, #040507 100%);
        }

        .ambient {
          position: fixed;
          border-radius: 999px;
          filter: blur(70px);
          opacity: 0.55;
          pointer-events: none;
          z-index: 0;
        }

        .ambient-1 {
          width: 280px;
          height: 280px;
          top: 7%;
          left: -4%;
          background: rgba(91, 33, 182, 0.35);
        }

        .ambient-2 {
          width: 300px;
          height: 300px;
          right: -6%;
          top: 20%;
          background: rgba(14, 165, 233, 0.22);
        }

        .ambient-3 {
          width: 360px;
          height: 360px;
          bottom: -10%;
          left: 25%;
          background: rgba(255, 255, 255, 0.08);
        }

        .top-nav-wrap {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          padding: 12px 20px 0;
          transition:
            transform 0.22s linear,
            opacity 0.22s linear,
            padding 0.3s ease;
          will-change: transform, opacity;
        }

        .top-nav-wrap.scrolled {
          padding-top: 8px;
        }

        .top-nav {
          max-width: 1400px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 16px;
          border-radius: 28px;
          padding: 14px 20px;
          background:
            linear-gradient(145deg, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.4));
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow:
            0 18px 50px rgba(0, 0, 0, 0.38),
            inset 0 1px 0 rgba(255, 255, 255, 0.12),
            inset 0 -1px 0 rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
        }

        .nav-brand {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 12px;
          justify-self: start;
        }

        .brand-logo-wrap {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
        }

        .brand-logo {
          width: 34px;
          height: 34px;
          object-fit: contain;
        }

        .brand-text {
          color: #f8fafc;
          font-size: 1.18rem;
          font-weight: 800;
          letter-spacing: 0.03em;
          white-space: nowrap;
          background: linear-gradient(90deg, #ffffff 0%, #dbeafe 40%, #c4b5fd 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-shadow: 0 8px 28px rgba(255, 255, 255, 0.08);
        }

        .nav-center {
          justify-self: center;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 6px;
        }

        .nav-btn {
          padding: 1px 6px;
          cursor: pointer;
          font-weight: 700;
          font-size: 14px;
          color: #e2e8f0;
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background-color: transparent;
        }

        .nav-btn-icon {
          display: none;
          align-items: center;
          justify-content: center;
          line-height: 0;
        }

        .nav-btn-label {
          display: inline-flex;
          align-items: center;
          font-size: 20px;
          margin-left: 8px;
          font-weight: 200;
        }

        .nav-btn:hover {
          transform: translateY(-1px);
        }

        .nav-right {
          justify-self: end;
          position: relative;
          display: flex;
          align-items: center;
        }

        .profile-trigger {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px 8px 8px;
          color: #f8fafc;
          cursor: pointer;
          transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .profile-trigger:hover {
          transform: translateY(-1px);
          border-color: rgba(255, 255, 255, 0.16);
        }

        .profile-avatar,
        .profile-dropdown-avatar {
          width: 38px;
          height: 38px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          color: #ffffff;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          box-shadow:
            0 8px 20px rgba(59, 130, 246, 0.28),
            inset 0 1px 0 rgba(255,255,255,0.18);
          flex-shrink: 0;
        }

        .profile-name {
          font-size: 14px;
          font-weight: 700;
          color: #e2e8f0;
          max-width: 170px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .profile-caret {
          font-size: 14px;
          color: #cbd5e1;
          transition: transform 0.2s ease;
        }

        .profile-caret.open {
          transform: rotate(180deg);
        }

        .profile-dropdown {
          position: absolute;
          top: calc(100% + 12px);
          right: 0;
          min-width: 260px;
          padding: 12px;
          border-radius: 20px;
          background:
            linear-gradient(180deg, rgba(10, 14, 26, 0.96), rgba(17, 24, 39, 0.92));
          border: 1px solid rgba(255,255,255,0.10);
          box-shadow:
            0 24px 50px rgba(0,0,0,0.35),
            inset 0 1px 0 rgba(255,255,255,0.08);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          opacity: 0;
          visibility: hidden;
          transform: translateY(8px);
          transition: all 0.22s ease;
          pointer-events: none;
        }

        .profile-dropdown.open {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
          pointer-events: auto;
        }

        .profile-dropdown-user {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 6px 4px 12px;
          margin-bottom: 10px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        .profile-dropdown-text {
          min-width: 0;
        }

        .profile-dropdown-email {
          color: #94a3b8;
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dropdown-logout-btn {
          width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.10);
          border-radius: 14px;
          padding: 12px 16px;
          cursor: pointer;
          font-weight: 700;
          color: #fff;
          background:
            linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(190, 24, 93, 0.95));
          box-shadow:
            0 12px 28px rgba(239, 68, 68, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.16);
          transition: transform 0.2s ease;
        }

        .dropdown-logout-btn:hover {
          transform: translateY(-1px);
        }

        .page-content {
          position: relative;
          z-index: 1;
          max-width: 1400px;
          margin: 0 auto;
          padding: 110px 20px 44px;
        }

        .section-block {
          scroll-margin-top: 132px;
          margin-bottom: 30px;
        }

        .section-hero-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .section-subtext {
          margin: 0;
          color: #94a3b8;
          font-size: 15px;
        }

        .loading-pill {
          padding: 10px 14px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          font-size: 14px;
          font-weight: 600;
        }

        .glass-section-card {
          border-radius: 24px;
          padding: 18px;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.025));
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow:
            0 12px 32px rgba(0, 0, 0, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }

        @media (max-width: 1100px) {
          .top-nav {
            grid-template-columns: auto 1fr auto;
            gap: 12px;
          }

          .nav-center {
            justify-self: stretch;
          }

          .nav-btn {
            padding: 10px 13px;
            font-size: 13px;
          }
        }

        @media (max-width: 900px) {
          .top-nav-wrap {
            padding: 10px 14px 0;
          }

          .top-nav {
            grid-template-columns: auto 1fr auto;
            padding: 12px 14px;
            border-radius: 22px;
            gap: 10px;
          }

          .nav-btn-label {
            display: none;
          }

          .nav-btn-icon {
            display: inline-flex;
            width: 18px;
            height: 18px;
          }

          .brand-text {
            display: none;
          }

          .brand-logo-wrap {
            width: 44px;
            height: 44px;
            border-radius: 14px;
          }

          .brand-logo {
            width: 30px;
            height: 30px;
          }

          .nav-center {
            gap: 8px;
            padding: 5px;
            min-width: 0;
          }

          .nav-btn {
            flex: 1 1 0;
            min-width: 0;
            font-size: 12px;
            padding: 10px 10px;
          }

          .profile-name {
            display: none;
          }

          .profile-trigger {
            padding: 6px 8px 6px 6px;
          }

          .profile-caret {
            font-size: 12px;
          }

          .page-content {
            padding: 100px 14px 34px;
          }
        }

        @media (max-width: 560px) {
          .home-page-shell {
            overflow-x: hidden;
          }

          .top-nav-wrap {
            padding: 8px 10px 0;
          }

          .top-nav {
            grid-template-columns: auto 1fr auto;
            border-radius: 20px;
            gap: 8px;
            padding: 10px;
          }

          .nav-center {
            gap: 6px;
            padding: 4px;
          }

          .nav-btn {
            padding: 9px 8px;
            border-radius: 12px;
          }

          .profile-dropdown {
            right: -4px;
            min-width: 220px;
          }

          .page-content {
            padding: 96px 10px 26px;
          }

          .section-block {
            scroll-margin-top: 118px;
          }
        }

        @media (max-width: 420px) {
          .nav-btn {
            font-size: 10.5px;
            padding: 8px 6px;
          }

          .brand-logo-wrap {
            width: 40px;
            height: 40px;
          }

          .profile-avatar,
          .profile-dropdown-avatar {
            width: 34px;
            height: 34px;
          }
        }
      `}</style>
    </div>
  );
}