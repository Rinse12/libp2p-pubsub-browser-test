First, run `yarn install --frozen-lockfile` to install all the dependencies.

After that, you need to deploy to netlify (to have secure connection). The command `yarn deploy:netlify` will webpack the files and deploy it on netlify for you. You may need to login to netlify. You should get a link to the page after deploying.
