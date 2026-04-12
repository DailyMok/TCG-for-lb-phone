fx_version 'cerulean'
game 'gta5'

name 'lb-tcg'
description 'TCG Card Collection App for LB Phone'
author 'dAIly'
version '1.0.0'

lua54 'yes'

dependencies {
    'oxmysql',
    'qb-core',
    'lb-phone',
}

shared_scripts {
    'shared/config.lua',
    'shared/zones.lua',
}

client_scripts {
    'client/utils.lua',
    'client/main.lua',
    'client/hunt.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/utils.lua',
    'server/migration.lua',
    'server/main.lua',
    'server/hunt.lua',
    'server/duel.lua',
    'server/spawn.lua',
}

ui_page 'ui/dist/index.html'

files {
    'ui/dist/index.html',
    'ui/dist/**/*',
    'static/**/*',
}
