/**
 * Seed script - pokretanje: npm run seed (iz backend/)
 * Zahtijeva MONGODB_URI u .env
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "../src/config/db";
import { User } from "../src/models/User";
import { Sport } from "../src/models/Sport";
import { Club } from "../src/models/Club";
import { BlogPost } from "../src/models/BlogPost";

const SALT_ROUNDS = 10;

async function seed() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error("MONGODB_URI nije postavljen u .env");
    process.exit(1);
  }

  await connectDB();
  console.log("Povezan na bazu. Pokrećem seed...\n");

  try {
    // 1. Super Admin
    let superAdmin = await User.findOne({ email: "admin@klublinker.me" });
    if (!superAdmin) {
      const hashedPassword = await bcrypt.hash("Admin123!", SALT_ROUNDS);
      superAdmin = await User.create({
        email: "admin@klublinker.me",
        password: hashedPassword,
        name: "Super Administrator",
        role: "superAdmin",
        status: "approved",
      });
      console.log("Kreiran Super Admin: admin@klublinker.me");
    } else {
      console.log("Super Admin već postoji: admin@klublinker.me");
    }

    // 2. Sportovi
    const sportSlugs = ["fudbal", "kosarka", "odbojka"];
    let fudbal = await Sport.findOne({ slug: "fudbal" });
    let kosarka = await Sport.findOne({ slug: "kosarka" });
    let odbojka = await Sport.findOne({ slug: "odbojka" });

    if (!fudbal) {
      fudbal = await Sport.create({
        name: { me: "Fudbal", en: "Football" },
        slug: "fudbal",
        description: {
          me: "Najpopularniji sport u Crnoj Gori sa bogatom tradicijom.",
          en: "The most popular sport in Montenegro with a rich tradition.",
        },
        icon: "/icons/football.svg",
      });
      console.log("Kreiran sport: Fudbal");
    }
    if (!kosarka) {
      kosarka = await Sport.create({
        name: { me: "Košarka", en: "Basketball" },
        slug: "kosarka",
        description: {
          me: "Košarka ima veliku tradiciju i uspjehe na međunarodnoj sceni.",
          en: "Basketball has a great tradition and success on the international scene.",
        },
        icon: "/icons/basketball.svg",
      });
      console.log("Kreiran sport: Košarka");
    }
    if (!odbojka) {
      odbojka = await Sport.create({
        name: { me: "Odbojka", en: "Volleyball" },
        slug: "odbojka",
        description: {
          me: "Odbojka je jedan od najbrže rastućih sportova u regiji.",
          en: "Volleyball is one of the fastest growing sports in the region.",
        },
        icon: "/icons/volleyball.svg",
      });
      console.log("Kreiran sport: Odbojka");
    }

    // 3. Demo klubovi (po 1 za svaki sport)
    let fkBuducnost = await Club.findOne({ slug: "fk-buducnost" });
    let kkBuducnost = await Club.findOne({ slug: "kk-buducnost-voli" });
    let okBudva = await Club.findOne({ slug: "ok-budva" });

    if (!fkBuducnost && fudbal) {
      fkBuducnost = await Club.create({
        name: "FK Budućnost Podgorica",
        slug: "fk-buducnost",
        sportId: fudbal._id,
        description: {
          me: "Najstariji fudbalski klub u Crnoj Gori, osnovan 1925. godine.",
          en: "The oldest football club in Montenegro, founded in 1925.",
        },
        location: { city: "Podgorica", country: "Crna Gora" },
        foundedYear: 1925,
        status: "approved",
      });
      console.log("Kreiran klub: FK Budućnost Podgorica");
    }
    if (!kkBuducnost && kosarka) {
      kkBuducnost = await Club.create({
        name: "KK Budućnost VOLI",
        slug: "kk-buducnost-voli",
        sportId: kosarka._id,
        description: {
          me: "Najuspješniji košarkaški klub Crne Gore sa 6 titula prvaka Jugoslavije.",
          en: "The most successful basketball club in Montenegro with 6 Yugoslav champion titles.",
        },
        location: { city: "Podgorica", country: "Crna Gora" },
        foundedYear: 1949,
        status: "approved",
      });
      console.log("Kreiran klub: KK Budućnost VOLI");
    }
    if (!okBudva && odbojka) {
      okBudva = await Club.create({
        name: "OK Budva",
        slug: "ok-budva",
        sportId: odbojka._id,
        description: {
          me: "Odbojkaški klub iz Budve sa velikim uspjesima u posljednjih nekoliko godina.",
          en: "Volleyball club from Budva with great success in recent years.",
        },
        location: { city: "Budva", country: "Crna Gora" },
        foundedYear: 1946,
        status: "approved",
      });
      console.log("Kreiran klub: OK Budva");
    }

    // 4. Demo korisnici (admini klubova)
    const clubAdminEmails = [
      { email: "admin@fkbuducnost.me", name: "Marko Petrović", club: fkBuducnost },
      { email: "admin@kkbuducnost.me", name: "Stefan Nikolić", club: kkBuducnost },
      { email: "admin@okbudva.me", name: "Ana Jovanović", club: okBudva },
    ];
    for (const { email, name, club } of clubAdminEmails) {
      if (!club) continue;
      const existing = await User.findOne({ email });
      if (!existing) {
        const hashedPassword = await bcrypt.hash("Demo123!", SALT_ROUNDS);
        await User.create({
          email,
          password: hashedPassword,
          name,
          role: "clubAdmin",
          clubId: club._id,
          status: "approved",
        });
        console.log(`Kreiran club admin: ${email}`);
      }
    }

    // 5. Demo sportista
    if (fkBuducnost && !(await User.findOne({ email: "petar.vukovic@example.me" }))) {
      const hashedPassword = await bcrypt.hash("Demo123!", SALT_ROUNDS);
      await User.create({
        email: "petar.vukovic@example.me",
        password: hashedPassword,
        name: "Petar Vuković",
        role: "athlete",
        clubId: fkBuducnost._id,
        athleteProfile: {
          bio: "Napadač FK Budućnost",
          position: "Napadač",
          dateOfBirth: new Date("1995-03-15"),
          nationality: "Crna Gora",
        },
        status: "approved",
      });
      console.log("Kreiran demo sportista: petar.vukovic@example.me");
    }

    // 6. Demo blog post
    if (superAdmin && fudbal && !(await BlogPost.findOne({ slug: "dobrodosli-na-klub-linker" }))) {
      await BlogPost.create({
        title: "Dobrodošli na Klub Linker!",
        slug: "dobrodosli-na-klub-linker",
        content:
          "<p>Dobrodošli na novu platformu za sportske klubove i sportiste Crne Gore.</p>",
        excerpt: "Dobrodošli na novu platformu za sportske klubove i sportiste Crne Gore.",
        authorId: superAdmin._id,
        sportId: fudbal._id,
        tags: ["vijesti", "platforma", "intro"],
        visibility: "public",
        status: "published",
        publishedAt: new Date(),
      });
      console.log("Kreiran demo blog post: Dobrodošli na Klub Linker!");
    }

    console.log("\nSeed završen uspješno.");
  } finally {
    await mongoose.disconnect();
    console.log("Veza sa bazom zatvorena.");
  }
}

seed().catch((err) => {
  console.error("Seed greška:", err);
  process.exit(1);
});
