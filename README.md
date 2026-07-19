# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Demo / seed data

`convex/seed.ts` seeds a realistic development and defense-demo fixture — institution,
KTU faculty/department/program/class hierarchy, courses with per-division schedules,
course activities, semester activities, and a ready-to-log-in demo student. It's the
source of demo data for this project — there's no manual data entry via the UI during
dev.

Run it against your dev deployment with:

```bash
npx convex run seed:seedAll '{"iAmSure": true}'
```

The `iAmSure` confirmation is required on purpose — see the comment on `seedAll` in
`convex/seed.ts` for why (Convex doesn't expose a reliable way for backend code to
detect dev vs. production, so this explicit flag is the safety gate). **Never run this
against a real production deployment.**

Demo login:

- Email: `demo@example.com`
- Password: `demo1234`

The seed is idempotent — every function checks for existing rows by a natural key
(name/code/combined lookup) before inserting, so re-running `seedAll` is always safe
and never creates duplicates. It never deletes or overwrites existing rows; a
wipe-and-reseed would be a separate, deliberately unbuilt script.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
