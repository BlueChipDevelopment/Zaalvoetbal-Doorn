# Futsal-Doorn Team Generator
This is a front-end application written with Angular 17 by using Angular Material Components to generate random but as balanced as possible teams for playing football. As much as it tries to make balanced teams, there is always some randomness in the code, so that things will get generated differently everytime. Which brings us to a point that might never exactly balanced but as close as possible.

- Each player will have 3 rates: attack, defense and condition with a position information
- This helps the application to use a biased calculation to generate a total score for a player then do the distribution depending on the positions as equally as possible

# Development
- You can just clone and run `npm install && npm run start` to start the test server, if you have `npm` and `angular 17` pre-installed

## General improvements
- [ ] Set players to active/inactive
- [ ] Adding a feature for limited access with a pincode

## Ease-of-use
- [ ] Read attendance based on a whatsapp poll 
- [ ] Add polling mechanism to replace using whatsapp

## UI/UX Enhancements
- [ ] Add drag-and-drop interface for manual team adjustments
- [ ] Add player profile pictures
- [ ] Add team lineup visualization with player positions on a field

## Team History & Statistics
- [ ] Save generated team combinations and their match results
- [ ] Player Chemistry. Gettings advanced statistics about players 

## Team Balance Improvements
- [ ] Add team balancing based on player chemistry data
- [ ] Create "fair teams" algorithm that considers historical performance