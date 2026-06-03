const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

async function getEventInformation()
{
    const response = await fetch('https://api.mcchampionship.com/v1/event');

    if (!response.ok)
    {
        throw new Error(`MCC API request failed with status ${response.status}`);
    }

    const payload = await response.json();

    if (!payload || !payload.data)
    {
        throw new Error('MCC API response did not include event data');
    }

    return payload.data;
}

async function getRundown()
{
    const response = await fetch('https://api.mcchampionship.com/v1/rundown');

    if (!response.ok)
    {
        throw new Error(`MCC API request failed with status ${response.status}`);
    }

    const payload = await response.json();

    if (!payload || !payload.data)
    {
        throw new Error('MCC API response did not include rundown data');
    }

    return payload.data;
}

async function getParticipants()
{
     const response = await fetch('https://api.mcchampionship.com/v1/participants');

    if (!response.ok)
    {
        throw new Error(`MCC API request failed with status ${response.status}`);
    }

    const payload = await response.json();

    if (!payload || !payload.data)
    {
        throw new Error('MCC API response did not include participant data');
    }

    return payload.data;
}

async function getParticipantsTeam(team)
{
     const response = await fetch(`https://api.mcchampionship.com/v1/participants/${team}`);

    if (!response.ok)
    {
        throw new Error(`MCC API request failed with status ${response.status}`);
    }

    const payload = await response.json();

    if (!payload || !payload.data)
    {
        throw new Error('MCC API response did not include participant data');
    }

    return payload.data;
}

function formatParticipantNames(participants)
{
    if (!Array.isArray(participants) || participants.length === 0)
    {
        return 'No participants available.';
    }

    const names = participants.map(participant => participant.username);
    const value = names.join(', ');

    if (value.length <= 1024)
    {
        return value;
    }

    const visibleNames = [];
    let totalLength = 0;

    for (const name of names)
    {
        const nextLength = visibleNames.length === 0 ? name.length : totalLength + 2 + name.length;

        if (nextLength > 980)
        {
            break;
        }

        visibleNames.push(name);
        totalLength = nextLength;
    }

    const remaining = names.length - visibleNames.length;

    return `${visibleNames.join(', ')}${remaining > 0 ? `, ... (+${remaining} more)` : ''}`;
}

function formatTopEntries(entries, formatter, limit)
{
    return entries
        .sort((left, right) => right[1] - left[1])
        .slice(0, limit)
        .map(([name, value], index) => formatter(name, value, index))
        .join('\n');
}

function formatDate(value)
{
    const date = new Date(value);

    if (Number.isNaN(date.getTime()))
    {
        return value ?? 'Unknown';
    }

    return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
}

module.exports =
{
    data: new SlashCommandBuilder()
        .setName('mcc')
        .setDescription('Get different MCC info')
        .addSubcommand(subcommand => subcommand
            .setName('event')
            .setDescription('Information of the current event cycle')
        )
        .addSubcommand(subcommand => subcommand
            .setName('rundown')
            .setDescription('Gives a rundown of the most recent event')
        )
        .addSubcommand(subcommand => subcommand
            .setName('participants')
            .setDescription('List all participants in event cycle. Specify team to see participents in the given team.')
            .addStringOption((option) =>
            option.setName('team')
                .setDescription('Team name')
                .setRequired(false)
                .addChoices(
                    { name: 'Red', value: 'RED'},
                    { name: 'Orange', value: 'ORANGE'},
                    { name: 'Yellow', value: 'YELLOW'},
                    { name: 'Lime', value: 'LIME'},
                    { name: 'Green', value: 'GREEN'},
                    { name: 'Cyan', value: 'CYAN'},
                    { name: 'Aqua', value: 'AQUA'},
                    { name: 'Blue', value: 'BLUE'},
                    { name: 'Purple', value: 'PURPLE'},
                    { name: 'Pink', value: 'PINK'}
                )
            )
        ),
    async execute(interaction)
    {
        await interaction.deferReply();

        try
        {
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'event')
            {
                const event = await getEventInformation();

                const embed = new EmbedBuilder()
                    .setColor(0x00A8FF)
                    .setTitle(`MCC Event Cycle ${event.event ?? 'Unknown'}`)
                    .addFields(
                        { name: 'Event', value: String(event.event ?? 'Unknown'), inline: true },
                        { name: 'Date', value: formatDate(event.date), inline: true },
                        {
                            name: 'Update Video',
                            value: event.updateVideo ? `[Watch here](${event.updateVideo})` : 'Unavailable',
                        },
                    );

                await interaction.editReply({ embeds: [embed] });
                return;
            }

            if (subcommand === 'rundown')
            {
                const rundown = await getRundown();

                const placements = Object.entries(rundown.eventPlacements ?? {})
                    .sort((left, right) => left[1] - right[1])
                    .slice(0, 3)
                    .map(([team, placement]) => `#${placement + 1} ${team}`)
                    .join('\n');

                const teamScores = formatTopEntries(
                    Object.entries(rundown.eventScores ?? {}),
                    (team, score) => `${team}: ${score.toLocaleString()}`,
                    3,
                );

                const individualScores = formatTopEntries(
                    Object.entries(rundown.individualScores ?? {}).filter(([, score]) => score !== null && score !== undefined),
                    (player, score) => `${player}: ${score.toLocaleString()}`,
                    5,
                );

                const dodgebolt = Object.entries(rundown.dodgeboltData ?? {})
                    .map(([team, wins]) => `${team}: ${wins}`)
                    .join('\n') || 'Unavailable';

                const gamesPlayed = Object.keys(rundown.history ?? {}).length;

                const embed = new EmbedBuilder()
                    .setColor(0x00A8FF)
                    .setTitle('A rundown of the most recent event')
                    .addFields(
                        { name: 'Dodgebolt', value: dodgebolt, inline: true },
                        { name: 'Top Placements', value: placements || 'Unavailable', inline: true },
                        { name: 'Top Team Scores', value: teamScores || 'Unavailable' },
                        { name: 'Top Individual Scores', value: individualScores || 'Unavailable' },
                        { name: 'Games Played', value: String(gamesPlayed), inline: true },
                    )

                await interaction.editReply({ embeds: [embed] });
                return;
            }

            if (subcommand === 'participants')
            {
                const team = interaction.options.getString('team');

                if (team)
                {
                    const participants = await getParticipantsTeam(team);

                    const embed = new EmbedBuilder()
                        .setColor(0x00A8FF)
                        .setTitle(`MCC Participants - ${team}`)
                        .setDescription(formatParticipantNames(participants));

                    await interaction.editReply({ embeds: [embed] });
                    return;
                }

                const participants = await getParticipants();
                const teamOrder = ['RED', 'ORANGE', 'YELLOW', 'LIME', 'GREEN', 'CYAN', 'AQUA', 'BLUE', 'PURPLE', 'PINK', 'SPECTATORS', 'NONE'];

                const embed = new EmbedBuilder()
                    .setColor(0x00A8FF)
                    .setTitle('MCC Participants')
                    .setDescription('Current event roster grouped by team')
                    .addFields(
                        teamOrder.map(teamName => ({
                            name: teamName,
                            value: formatParticipantNames(participants[teamName]),
                            inline: false,
                        }))
                    )

                await interaction.editReply({ embeds: [embed] });
                return;
            }

            await interaction.editReply({ content: 'Unknown MCC subcommand.' });
        }
        catch (error)
        {
            console.error('Failed to load MCC rundown information:', error);
            await interaction.editReply({ content: 'Unable to load MCC rundown information right now.' });
        }
    }
}